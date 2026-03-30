## SpotFree
SpotFree is a microservices-based parking management system. It allows users to view real-time availability, reserve spaces, and manage bookings. The architecture features a React frontend, FastAPI backend services, PostgreSQL, and RabbitMQ, containerized with Docker.

---
### Dashboard and System Architecture

<p align="center">
  <img src="https://github.com/user-attachments/assets/6548ee70-1759-44d5-b502-278a51bd8dd1" width="47%" style="vertical-align: middle;" />
  &nbsp;&nbsp;
  <img src="https://github.com/user-attachments/assets/3cd8a3d5-3294-496a-ac38-631ec90a3f96" width="47%" style="vertical-align: middle;" />
</p>

---

### Installation and Setup

**Prerequisites:** Docker Desktop, Node.js (v18+), and npm.

#### 1. Clone Repository
```bash
git clone <your-repo-url>
cd spotfree
```

#### 2. Backend Services
```bash
docker compose up --build
```
*Note: This starts all microservices, PostgreSQL, and RabbitMQ.*

#### 3. Frontend Application
```bash
cd frontend
npm install
npm run dev
```

---

### Service Endpoints

| Service | URL |
| :--- | :--- |
| **Frontend** | http://localhost:3000 |
| **User Service** | http://localhost:8004/docs |
| **Parking Lot Service** | http://localhost:8001/docs |
| **Reservation Service** | http://localhost:8002/docs |
| **Pricing Service** | http://localhost:8003/docs |
| **RabbitMQ Admin** | http://localhost:15672 (guest/guest) |

---

### Usage
1. **Register/Login:** Create an account on the local instance.
2. **Reserve:** Select a parking lot and book a space.
3. **Manage:** View bookings via the *My Reservations* tab.

---

### Maintenance

**Stop Services:**
```bash
docker compose down
```

**Full Reset:**
```bash
docker compose down -v
docker compose up --build
```

---

### Technical Notes
* Database: Local PostgreSQL instance running in Docker.
* Each user must register an account on their own local instance.
