# import generated classes
import grpc
from concurrent import futures
import pricing_pb2
import pricing_pb2_grpc
import psycopg2  # for PostgreSQL
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# create the application
app = FastAPI(title="Pricing Service")

# the * means allow requests from any origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# FastAPI health check (optional)
app = FastAPI(title="Pricing Service")
@app.get("/health")
def health():
    return {"status": "ok", "service": "pricing"}

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

# implement the PricingServer gRPC server
# each RPC request is handled by CalculatePrice
class PricingService(pricing_pb2_grpc.PricingServiceServicer):

    def CalculatePrice(self, request, context):
        """
        Calculate the total price for a given parking lot and time range.

        Steps:
        1. Open a new DB connection for this request.
        2. Parse start and end times from the request.
        3. Calculate total hours of the reservation.
        4. Query pricing_rules table for the lot.
        5. Determine if the reservation falls in peak or off-peak hours.
        6. Compute the total cost.
        7. Return a PriceResponse to the client.
        """
        conn = get_db() # open a fresh db connection
        cur = conn.cursor() # cursor = interface to run SQL

        # extract request data
        lot_id = request.lot_id
        start_time = datetime.fromisoformat(request.start_time)
        end_time = datetime.fromisoformat(request.end_time)
        hours = int((end_time - start_time).total_seconds() / 3600)

        # query the pricing_rules table for the given lot
        cur.execute("""
            SELECT base_rate, peak_rate, peak_start, peak_end
            FROM pricing_rules
            WHERE lot_id = %s
        """, (lot_id,))
        row = cur.fetchone()

        # If lot_id is not found, return lot DNE
        if not row:
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details('Lot ID not found')
            cur.close()
            conn.close()
            return pricing_pb2.PriceResponse()
        
        # extract pricing information
        base_rate, peak_rate, peak_start, peak_end = row

        # if the reservation is in peak hours
        if peak_start <= start_time.hour < peak_end:
            rate = peak_rate # set rate to peak rate
            rate_type = "peak"
        else:
            rate = base_rate # otherwise off-peak rate
            rate_type = "off-peak"

        # calculate total cost
        total = rate * hours # total price for set number of hours

        # close DB resources
        cur.close()
        conn.close()

        # return the gRPC response - including total price, rate type, and number of hours
        return pricing_pb2.PriceResponse(
            total=total,
            rate_type=rate_type,
            hours=hours
        )
    

def serve():
    """
    Starts the gRPC server and listens for requests.
    """

    # create a gRPC server with a thread pool to handle multiple clients
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))

    # add our PricingService implementation to the server
    pricing_pb2_grpc.add_PricingServiceServicer_to_server(PricingService(), server)

    # bind the server to port 50051 (common gRPC port for testing)
    server.add_insecure_port('[::]:50051')

    # start the server
    server.start()
    print("Pricing gRPC server running on port 50051...")

    # keep the server running indefinitely
    server.wait_for_termination()

# start gRPC server if run directly
if __name__ == "__main__":
    serve()


