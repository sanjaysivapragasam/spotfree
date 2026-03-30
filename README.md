Running SpotFree
Prerequisites
Docker Desktop installed and running
Node.js (v18 or higher) and npm installed
1. Clone the Repository
git clone <your-repo-url>
cd spotfree
2. Start Backend Services (Docker)
docker compose up --build

The first run may take several minutes as Docker downloads required images. This starts all backend services, PostgreSQL, and RabbitMQ.

3. Start Frontend Application

Open a new terminal:

cd frontend
npm install
npm run dev

The frontend will be available at:
http://localhost:3000

4. Access the Application

Frontend:
http://localhost:3000

API Documentation (Swagger):

User Service: http://localhost:8004/docs
Parking Lot Service: http://localhost:8001/docs
Reservation Service: http://localhost:8002/docs
Pricing Service: http://localhost:8003/docs

RabbitMQ Dashboard:

http://localhost:15672
Username: guest
Password: guest
5. Usage
Register a new account on the login page
Log in to access the dashboard
Select a parking lot and reserve an available space
View and manage reservations under the "My Reservations" tab
6. Stop the System
docker compose down
Notes
The system uses a local PostgreSQL database running inside Docker
Each user must register an account on their own local instance

To reset the database completely:

docker compose down -v
docker compose up --build

This will remove all stored data, including users and reservations.
