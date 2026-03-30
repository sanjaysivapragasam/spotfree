# SpotFree 🚗

**SpotFree** is a smart parking management system that enables users to view parking availability, reserve spaces, and manage bookings in real time.

The system is built using a **microservices architecture** with a React frontend and FastAPI backend services, supported by PostgreSQL and RabbitMQ. It demonstrates key distributed systems concepts such as service decomposition, asynchronous messaging, and containerized deployment using Docker.

-----

## 🖥️ Dashboard

-----

## 🚀 Running SpotFree

### Prerequisites

  * **Docker Desktop** installed and running
  * **Node.js** (v18 or higher) and **npm** installed

### 1\. Clone the Repository

```bash
git clone <your-repo-url>
cd spotfree
```

### 2\. Start Backend Services (Docker)

```bash
docker compose up --build
```

> **Note:** The first run may take several minutes as Docker downloads required images. This starts all backend services, PostgreSQL, and RabbitMQ.

### 3\. Start Frontend Application

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

-----

## 🔗 Access the Application

| Component | URL |
| :--- | :--- |
| **Frontend** | http://localhost:3000 |
| **User Service** | http://localhost:8004/docs |
| **Parking Lot Service** | http://localhost:8001/docs |
| **Reservation Service** | http://localhost:8002/docs |
| **Pricing Service** | http://localhost:8003/docs |
| **RabbitMQ Dashboard** | http://localhost:15672 |

**RabbitMQ Credentials:**

  * **Username:** `guest`
  * **Password:** `guest`

-----

## 🛠️ Usage

1.  **Register** a new account on the login page.
2.  **Log in** to access the dashboard.
3.  **Select** a parking lot and reserve an available space.
4.  **Manage** reservations under the *My Reservations* tab.

-----

## 🛑 Stop the System

To stop all running containers:

```bash
docker compose down
```

### Reset Database

If you need to wipe all stored data and start fresh:

```bash
docker compose down -v
docker compose up --build
```

-----

## 📝 Notes

  * The system uses a local **PostgreSQL** database running inside Docker.
  * Each user must register an account on their own local instance.

-----

**Would you like me to add a "Features" section or a list of the tech stack icons to make the README look even more professional?**
