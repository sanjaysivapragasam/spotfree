# FastAPI is the framework for the HTTP server
from fastapi import FastAPI, HTTPException
# CORS middleware to allow frontend/other services to call this service
from fastapi.middleware.cors import CORSMiddleware
# Pydantic BaseModel for request/response schemas
from pydantic import BaseModel
# Type hints
from typing import List, Optional
# PostgreSQL connector
import psycopg2
# For environment variables
import os
# For datetime parsing and handling
from datetime import datetime
# For gRPC communication with Pricing Service
import grpc
import pricing_pb2
import pricing_pb2_grpc
# For publishing events to RabbitMQ
import pika
import json
import time
import requests


# ─── App Setup ───────────────────────────────────────────────────────────────

app = FastAPI(title="Reservation Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# every endpoint calls this method to open a fresh DB connection
def get_db():
    # os.environ.get("db_url", "..."")
    # uses the environment variable if it exists, otherwise
    # fall back to the default. the default uses
    # local host if run without docker. 
    # inisde Docker, it uses the env variable which points
    # to db, the container name
    return psycopg2.connect(os.environ.get(
        # enviornment variables are writting in all caps
        "DATABASE_URL",
        # 5432 is PostgreSQL default port
        "postgresql://admin:secret@localhost:5432/spotfree"
    ))

class ReservationCreate(BaseModel):
    # Everything the client must send to create a booking
    user_id: int
    space_id: int
    start_time: str  # ISO 8601 string, e.g. "2025-06-01T09:00:00"
    end_time: str    # ISO 8601 string, e.g. "2025-06-01T11:00:00"

class Reservation(BaseModel):
    # Full reservation returned from DB reads
    id: int
    user_id: int
    space_id: int
    start_time: datetime
    end_time: datetime
    status: str           # "active", "completed", or "cancelled"
    total_price: float
    created_at: datetime



def get_pricing_stub():
    # Opens a gRPC channel to the Pricing Service and returns a stub (client).
    # PRICING_SERVICE_URL defaults to localhost for running outside Docker.
    # Inside Docker, the env var should point to the pricing container name and port.
    pricing_url = os.environ.get("PRICING_SERVICE_URL", "localhost:50051")
    channel = grpc.insecure_channel(pricing_url)
    return pricing_pb2_grpc.PricingServiceStub(channel)


def call_parking_lot_service(space_id: int, occupied: bool):
    # Calls the Parking Lot Service over HTTP to update a space's occupied status.
    # PUT /spaces/{space_id}/occupy?occupied=true|false
    # Raises HTTPException if the Parking Lot Service returns an error.
    parking_url = os.environ.get("PARKING_LOT_SERVICE_URL", "http://localhost:8000")
    url = f"{parking_url}/spaces/{space_id}/occupy"
    
    resp = requests.put(url, params={"occupied": occupied})
    
    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Space not found in Parking Lot Service")
    resp.raise_for_status()  # catches any other 4xx/5xx
    return resp.json()

def publish_event(event_type: str, payload: dict):
    # Publishes a JSON event to the 'reservation_events' RabbitMQ queue.
    # The Notification Service listens on this queue.
    # event_type examples: "reservation_created", "reservation_cancelled"

    rabbitmq_url = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
    try:
        connection = pika.BlockingConnection(pika.URLParameters(rabbitmq_url))
        channel = connection.channel()
        # durable=True matches the queue declaration in the Notification Service
        channel.queue_declare(queue="reservation_events", durable=True)
        message = json.dumps({"event": event_type, **payload})
        channel.basic_publish(
            exchange="",
            routing_key="reservation_events",
            body=message,
            # make messages persistent so they survive RabbitMQ restart
            properties=pika.BasicProperties(delivery_mode=2)
        )
        connection.close()
    except pika.exceptions.AMQPConnectionError as e:
        # Log the error but don't fail the request — notification is non-critical
        print(f"[Reservation] Warning: Could not publish to RabbitMQ: {e}")


def get_lot_id_for_space(cur, space_id: int) -> int:
    # Looks up the lot_id for a given space_id.
    # Used to call the Pricing Service, which works at the lot level.
    cur.execute("SELECT lot_id FROM parking_spaces WHERE id = %s", (space_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Space not found")
    return row[0]


# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "reservation"}


@app.post("/reservations", response_model=Reservation, status_code=201)
def create_reservation(body: ReservationCreate):
    #Books a parking space for a user.
    """
    Steps:
    1. Check the space isn't already occupied (DB read).
    2. Call the Pricing Service over gRPC to get the total price.
    3. Save the reservation to the DB (DB write).
    4. Call the Parking Lot Service over HTTP to mark the space occupied.
    5. Publish a "reservation_created" event to RabbitMQ.
    6. Return the new reservation.
    """
    conn = get_db()
    cur = conn.cursor()

    # Step 1: Check space availability 
    cur.execute(
        "SELECT is_occupied FROM parking_spaces WHERE id = %s",
        (body.space_id,)
    )
    space = cur.fetchone()
    if not space:
        conn.close()
        raise HTTPException(status_code=404, detail="Parking space not found")
    if space[0]:  # is_occupied == True
        conn.close()
        raise HTTPException(status_code=409, detail="Parking space is already occupied")

    # Step 2: Get price from Pricing Service via gRPC 
    lot_id = get_lot_id_for_space(cur, body.space_id)
    try:
        stub = get_pricing_stub()
        # The reservation service is considered the grpc client, who sends a price request to the grpc server (pricing service)
        # with the lot_id, start_time and end_time. The pricing service can determine the pricing based on these parameters
        # and it responds with the total price, rate type (peak or off-peak) and hours booked for.
        price_response = stub.CalculatePrice(pricing_pb2.PriceReq(
            lot_id=lot_id,
            start_time=body.start_time,
            end_time=body.end_time
        ))
        # response from the grpc server (pricing service)
        total_price = price_response.total
    except grpc.RpcError as e:
        conn.close()
        raise HTTPException(
            status_code=503,
            detail=f"Pricing Service error: {e.details()}"
        )

    # Step 3: Save reservation to DB 
    # Once the reservation service receives the pricing for the reservation from the pricing service (via gRPC), it can now update the reservation
    # with all of the parameters and store it in the DB
    cur.execute(
        """
        INSERT INTO reservations (user_id, space_id, start_time, end_time, status, total_price)
        VALUES (%s, %s, %s, %s, 'active', %s)
        RETURNING id, user_id, space_id, start_time, end_time, status, total_price, created_at
        """,
        (body.user_id, body.space_id, body.start_time, body.end_time, total_price)
    )
    row = cur.fetchone()
    conn.commit()
    conn.close()

    # Organize the reservation into a Python dictionary so it can be published as an event to RabbitMQ for the Notification Service.
    reservation = Reservation(
        id=row[0],
        user_id=row[1],
        space_id=row[2],
        start_time=row[3],
        end_time=row[4],
        status=row[5],
        total_price=float(row[6]),
        created_at=row[7]
    )

    # Step 4: Mark space as occupied in Parking Lot Service
    call_parking_lot_service(body.space_id, occupied=True)

    # Step 5: Publish event to RabbitMQ for Notification Service 
    publish_event("reservation_created", {
        "reservation_id": reservation.id,
        "user_id": reservation.user_id,
        "space_id": reservation.space_id,
        "start_time": body.start_time,
        "end_time": body.end_time,
        "total_price": total_price
    })

    return reservation


@app.get("/reservations/user/{user_id}", response_model=List[Reservation])
def get_user_reservations(user_id: int):
    # Returns all reservations for a given user, most recent first.
    # Called by the frontend to show a user's booking history.

    conn = get_db()
    cur = conn.cursor()
    # Query to get the reservations of a particular user.
    cur.execute("""
        SELECT r.id, r.user_id, r.space_id, r.start_time, r.end_time, 
            r.status, r.total_price, r.created_at,
            ps.space_number, pl.name as lot_name
        FROM reservations r
        JOIN parking_spaces ps ON ps.id = r.space_id
        JOIN parking_lots pl ON pl.id = ps.lot_id
        WHERE r.user_id = %s
        ORDER BY r.created_at DESC
    """, (user_id,))
    rows = cur.fetchall()
    conn.close()

    # if no reservation data is returned
    if not rows:
        return [] # return empty array when user has no reservations yet

    # Organizing the SQL data into a Python dictionary to be returned when a get user reservations request is made.
    return [
    {
        "id": r[0],
        "user_id": r[1],
        "space_id": r[2],
        "start_time": r[3],
        "end_time": r[4],
        "status": r[5],
        "total_price": float(r[6]),
        "created_at": r[7],
        "space_number": r[8],
        "lot_name": r[9]
    }
    for r in rows
]


@app.delete("/reservations/{reservation_id}")
def cancel_reservation(reservation_id: int):
    #Cancels an active reservation.
    
    """
    Steps:
    1. Fetch the reservation — 404 if not found, 409 if already cancelled/completed.
    2. Set status to 'cancelled' in the DB.
    3. Call the Parking Lot Service to mark the space as free.
    4. Publish a "reservation_cancelled" event to RabbitMQ.
    5. Return confirmation.
    """
    conn = get_db()
    cur = conn.cursor()

    # Step 1: Fetch reservation using the reservation id
    cur.execute(
        "SELECT id, space_id, status FROM reservations WHERE id = %s",
        (reservation_id,)
    )
    row = cur.fetchone()

    # if no reservation data is returned based on the id, it would raise an HTTP exception
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Reservation not found")

    # If the reservation is active, it cannot be cancelled (no refund policy)
    res_id, space_id, status = row
    if status != "active":
        conn.close()
        raise HTTPException(
            status_code=409,
            detail=f"Reservation cannot be cancelled — current status: '{status}'"
        )

    # Step 2: Update status to 'cancelled'
    cur.execute(
        "UPDATE reservations SET status = 'cancelled' WHERE id = %s",
        (reservation_id,)
    )
    conn.commit()
    conn.close()

    # Step 3: Free the space in Parking Lot Service 
    call_parking_lot_service(space_id, occupied=False)

    # Step 4: Publish cancellation event to RabbitMQ 
    publish_event("reservation_cancelled", {
        "reservation_id": res_id,
        "space_id": space_id
    })

    return {"reservation_id": res_id, "status": "cancelled"}