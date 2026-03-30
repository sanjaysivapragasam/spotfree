SpotFree

SpotFree is a smart parking management system that enables users to view parking availability, reserve spaces, and manage bookings in real time. The system is built using a microservices architecture with a React frontend and FastAPI backend services, supported by PostgreSQL and RabbitMQ. It demonstrates key distributed systems concepts such as service decomposition, asynchronous messaging, and containerized deployment using Docker.

<img width="512" height="368" alt="image" src="https://github.com/user-attachments/assets/049c2bbc-ece5-4d14-bbdd-56c3688dea0e" />
<img width="512" height="117" alt="image" src="https://github.com/user-attachments/assets/c10aafa1-2662-4b55-af87-a8228db7afcf" />


Running SpotFree Prerequisites:  

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
