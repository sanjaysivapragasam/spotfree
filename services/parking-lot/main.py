# FastAPi is framework needed to create app, HTTP exception lets error 404 return instead of crashing
from fastapi import FastAPI, HTTPException
# browser security rule called CORS that blocks frontend from calling backend, the middlewar
# turns off the restriction
from fastapi.middleware.cors import CORSMiddleware
# used to define what data looks like, blueprint for JSON responses
from pydantic import BaseModel
# python type hints, so List[parkinglot] is list of parking lot objects
# and optional[int] means int or None
from typing import List, Optional
# postgreSQl connector
import psycopg2
# allows environment variables like Database_url to be read
import os


# create the application
app = FastAPI(title="Parking Lot Service")

# the * means allow requests from any origin
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
        # enviornment variables are writing in all caps
        "DATABASE_URL",
        # 5432 is PostgreSQL default port
        "postgresql://admin:secret@localhost:5432/spotfree"
    ))


# formatting the model of the serialized methods
# when FastAPi returns a ParkingLot, it should automatically
# convert to JSON. so JSON goes to the frontend or another service
# that called the endpoint, and FastAPI converts ParkingLot objects
# to JSOn via classes below

# parking Lot to parking space has 1 to many relationship
class ParkingLot (BaseModel):
    id: int # unique identifier
    name: str # display to user
    location: str # display to user
    total_spaces: int # show denominator of space count ie 12/20
    # optional means its allowed to be null
    # available spaces isnt stored in parking_lots table,
    # but its calculated by SQL join, so it doesn't exist before
    # the calculation is executed
    available_spaces: Optional[int] = None
    
class ParkingSpace (BaseModel):
    id: int # unique identifier
    lot_id: int # to know which lot it belongs too
    space_number: str # ie A1, or B1 to display on grid
    is_occupied: bool # so frontend can colour as green or red
    space_type: str # so frontend can show if its EV or accessible friendly

# health check endpoint to ensure the service is running
@app.get("/health")
def health():
    return {"status": "ok", "service": "parking-lot"}

# this function runs when a GET request is made to /lots
# this is called by frontend everytime dashboard loads to populate
# the sidebar with lot cards
# response_model tells FastAPI the response will be a list
# of ParkingLot objects
@app.get("/lots", response_model=List[ParkingLot])
def get_all_lots():
    conn = get_db() # open connection to PostgreSQL
    cur = conn.cursor() # cursor = interface to run SQL
    # query the parking_lots table to find all parking lot info
    # and count the available parking spaces in the specific parking lot
    # ie. 12 available spots
    #Then join this query result with the parking_spaces table where the
    # lot_id matches so the lot is matched to all its specific spots. 
    # LEFT JOIN means to includes the lot even if it has 0 spaces
    # GROUP BY is used to group results based on the lot because
    # the number of spots is being counted
    cur.execute("""
    SELECT pl.id, pl.name, pl.location, pl.total_spaces,
        COUNT (ps.id) FILTER (WHERE ps.is_occupied = false) AS available
    FROM parking_lots pl
    LEFT JOIN parking_spaces ps ON ps.lot_id = pl.id
    GROUP BY pl.id""")
    # in summary: for required 4 columns from the parking lot table,
    # count rows from parking space table where its not occupied, and
    # name the calculated value as "available"
    # then left JOIN will combine the tables where the lot_id's match
    
    rows = cur.fetchall() # get all the results as a list of tuples
    conn.close() # close connection when done
    return[
        ParkingLot(
            id = r[0],
            name = r[1],
            location = r[2],
            total_spaces = r[3],
            available_spaces = r[4]
        )
        for r in rows
    ]
    
# second endpoint for parking spaces
# called by frontend everytime a user clicks on a lot to show
# the parking lot's grid
@app.get("/lots/{lot_id}/spaces", response_model=List[ParkingSpace])
# validating for integer for lot_id as function parameter
def get_spaces_for_lot(lot_id: int):
    # connect to DB and set up interface to run SQL
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        # for the required 4 columns from the parking spaces table,
        # find where the lot id = the lot id in the URL path
        """
        SELECT id, lot_id, space_number, is_occupied, space_type
        FROM parking_spaces
        WHERE lot_id = %s""", (lot_id,)
        # %s is a placeholder for lot_id
        # (lot_id,) with the comma makes a tuple
    )
    # python code asks DB for data after query, so cur.execute() sends query
    # and cur.fetchall() pulls results back into Python memory
    rows = cur.fetchall()
    conn.close()
    if not rows:
        # if no rows exist, the parking lot doesnt exist
        raise HTTPException(status_code=404, detail = "Lot not found or has no spaces")
    return [ 
            ParkingSpace (
                id = r[0],
                lot_id = r[1],
                space_number = r[2],
                is_occupied = r[3],
                space_type=r[4]
            )
            for r in rows
            ]
    
    
# third endpoint for updating a parking spot has been taken/full
# called by reservation service everytime a booking is made or cancelled
@app.put("/spaces/{space_id}/occupy")
def set_space_occupied(space_id: int, occupied: bool):
    conn = get_db()
    cur = conn.cursor()
    # for the parking space table, change the is_occupied column to
    # the value provided (T/F) for the rows where the id matches
    # after updating, return the id of the changed row
    cur.execute(
        "UPDATE parking_spaces SET is_occupied = %s WHERE id = %s RETURNING id",
        (occupied, space_id)        
    )
    # commit the query that changes the data like INSERT, UPDATE, DELETE
    # so the change is not rolled back when the connection closes
    result = cur.fetchone() # first row as a single tuple or None if no matches
    conn.commit()
    conn.close()
    
    if not result:
        raise HTTPException(status_code = 404, detail = "Space not found")
    return {"space_id": space_id, "is_occupied": occupied}
