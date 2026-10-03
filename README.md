# 🚛 FleetCare — Fleet Maintenance Forecast System

A full-stack web application for managing fleet vehicles, drivers, trips, maintenance, repairs, and forecasting upcoming service needs using historical usage data.

---

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Prerequisites — Install MySQL First](#prerequisites--install-mysql-first)
- [Database Setup](#database-setup)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [Running the Project](#running-the-project)
- [Default Login Credentials](#default-login-credentials)
- [User Roles](#user-roles)
- [API Endpoints](#api-endpoints)
- [Forecasting Algorithm](#forecasting-algorithm)
- [Project Folder Structure](#project-folder-structure)

---

## Project Overview

FleetCare helps fleet management companies:
- Track **vehicles**, **drivers**, **trips**, and **service history**
- Record **maintenance** and **repair** work
- **Forecast** upcoming maintenance using actual usage patterns
- Generate **automatic alerts** for overdue services, expiring licenses, and long-running repairs
- View a real-time **dashboard** with charts, statistics, and cost summaries

---

## Features

✅ JWT Authentication (Login / Register / Logout)  
✅ Role-Based Access Control (Admin / Fleet Manager / Technician)  
✅ Vehicle Management — full CRUD with status tracking  
✅ Driver Management — license expiry tracking  
✅ Trip Management — auto-updates vehicle odometer and status  
✅ Maintenance Management — schedule, record, complete service  
✅ Repair Management — problem tracking with downtime hours  
✅ Maintenance Forecasting — algorithm based on real usage data  
✅ Automatic Alert Generation — 8 alert conditions covered  
✅ Dashboard — stats, 7 charts, 5 live data tables  
✅ Reports — maintenance cost, repair cost, utilisation, availability  
✅ Vehicle Availability Board  
✅ Technician Work Queue (My Work)  
✅ Settings — profile and password management  
✅ Fully responsive (Desktop / Tablet / Mobile)  

---

## Technology Stack

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | React 18 + Vite |
| Language | JavaScript (ES2020+) |
| Routing | React Router v6 |
| HTTP Client | Axios |
| Charts | Recharts |
| Styling | Custom CSS (no Bootstrap dependency) |

### Backend
| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Framework | Express.js |
| Auth | JWT (jsonwebtoken) |
| Passwords | bcryptjs |
| Validation | express-validator |
| Security | Helmet, CORS |
| Logging | Morgan |
| DB Driver | mysql2/promise |
| Dev Server | Nodemon |

### Database
| Layer | Technology |
|-------|-----------|
| RDBMS | MySQL 8.0+ |
| Design | Normalized relational (9 tables) |
| Safety | Parameterised queries throughout |

---

## Prerequisites — Install MySQL First

> ⚠️ **You must have MySQL Server running before starting the backend.**

### Option A: MySQL Installer (Recommended for Windows)

1. Go to: **https://dev.mysql.com/downloads/installer/**
2. Download **MySQL Installer for Windows** (the full ~450 MB version)
3. Run the installer, choose **"Developer Default"** setup type
4. This installs:
   - MySQL Server 8.0
   - MySQL Workbench (GUI tool)
   - MySQL Shell
5. During setup:
   - Set root password to: **`root`** (must match the `.env` file)
   - Leave port as **3306**
   - Finish the wizard

### Option B: XAMPP (Easiest — includes phpMyAdmin)

1. Go to: **https://www.apachefriends.org/**
2. Download and install XAMPP
3. Open XAMPP Control Panel → click **Start** next to **MySQL**
4. The default XAMPP root password is **blank** — update the `.env` accordingly

### Verify MySQL is Running

Open PowerShell or Command Prompt and type:

```powershell
mysql -u root -p
```

Enter your password. If you see the `mysql>` prompt, MySQL is running. Type `exit` to quit.

---

## Database Setup

### Step 1 — Open MySQL Workbench

1. Launch **MySQL Workbench**
2. Click on **Local instance MySQL80** (or your connection)
3. Enter your root password and connect

### Step 2 — Import the database

In MySQL Workbench:
1. Go to **File → Open SQL Script**
2. Browse to: `C:\Users\Kamesh\OneDrive\Desktop\DB\database.sql`
3. Click **Open**
4. Click the **⚡ Execute** button (lightning bolt, or press Ctrl+Shift+Enter)
5. Wait for "fleet_maintenance database created successfully" to appear in the output

**OR using Command Line:**

```powershell
mysql -u root -p < "C:\Users\Kamesh\OneDrive\Desktop\DB\database.sql"
```

This creates the database with:
- 9 tables with proper foreign keys and constraints
- 5 sample users
- 12 sample vehicles (covering all statuses)
- 8 drivers (including one with expired license)
- 35+ sample trips
- 25+ maintenance records
- 12 repair records
- 6 seed alerts
- 8 service types

---

## Backend Setup

### Step 1 — Verify environment file

Open `backend/.env` — it should contain:

```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=root
DB_NAME=fleet_maintenance

JWT_SECRET=fleet_maintenance_dev_secret_change_in_production_9f2b7c1e4a
JWT_EXPIRES_IN=8h

CLIENT_URL=http://localhost:5173
```

> If your MySQL root password is different, update `DB_PASSWORD` here.

### Step 2 — Install dependencies

```powershell
cd "C:\Users\Kamesh\OneDrive\Desktop\DB\backend"
npm install
```

### Step 3 — Start the backend

```powershell
npm run dev
```

You should see:
```
MySQL connected -> fleet_maintenance@localhost
Fleet Maintenance API listening on http://localhost:5000
Health check: http://localhost:5000/api/health
```

---

## Frontend Setup

### Step 1 — Install dependencies

Open a **new terminal**:

```powershell
cd "C:\Users\Kamesh\OneDrive\Desktop\DB\frontend"
npm install
```

### Step 2 — Start the frontend

```powershell
npm run dev
```

You should see:
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

---

## Running the Project

You need **two terminals open simultaneously**:

**Terminal 1 — Backend:**
```powershell
cd "C:\Users\Kamesh\OneDrive\Desktop\DB\backend"
npm run dev
```

**Terminal 2 — Frontend:**
```powershell
cd "C:\Users\Kamesh\OneDrive\Desktop\DB\frontend"
npm run dev
```

Then open your browser: **http://localhost:5173**

---

## Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@fleet.com` | `Admin@123` |
| **Fleet Manager** | `manager@fleet.com` | `Manager@123` |
| **Fleet Manager** | `manager2@fleet.com` | `Manager@123` |
| **Technician** | `tech@fleet.com` | `Tech@123` |
| **Technician** | `tech2@fleet.com` | `Tech@123` |

> These credentials are shown on the login page for quick access.

---

## User Roles

### Admin
- Full access to everything
- Can create, edit, delete any record
- Can manage user accounts and roles
- Can view all reports and analytics

### Fleet Manager
- Can view and manage vehicles, drivers, trips
- Can schedule maintenance and record repairs
- Can view forecasts, alerts, and reports
- Cannot manage user accounts

### Technician
- Can view "My Work" queue (maintenance and repairs assigned to them)
- Can update service status and add repair details
- Can view vehicles and alerts
- Cannot create vehicles, trips, or manage users

---

## API Endpoints

### Authentication
| Method | URL | Access | Description |
|--------|-----|--------|-------------|
| POST | `/api/auth/login` | Public | Login with email/password |
| POST | `/api/auth/register` | Public | Register (Manager/Tech only) |
| GET | `/api/auth/profile` | Auth | Get own profile |
| PUT | `/api/auth/profile` | Auth | Update own profile |
| PUT | `/api/auth/password` | Auth | Change own password |

### Vehicles
| Method | URL | Access | Description |
|--------|-----|--------|-------------|
| GET | `/api/vehicles` | Auth | List vehicles (paginated, filterable) |
| GET | `/api/vehicles/:id` | Auth | Get vehicle with full history |
| POST | `/api/vehicles` | Admin/Manager | Create vehicle |
| PUT | `/api/vehicles/:id` | Admin/Manager | Update vehicle |
| DELETE | `/api/vehicles/:id` | Admin | Delete vehicle |
| GET | `/api/vehicles/availability` | Auth | Availability board |
| GET | `/api/vehicles/meta/options` | Auth | Dropdown data |

### Drivers
| Method | URL | Access | Description |
|--------|-----|--------|-------------|
| GET | `/api/drivers` | Auth | List drivers |
| GET | `/api/drivers/:id` | Auth | Get driver |
| POST | `/api/drivers` | Admin/Manager | Create driver |
| PUT | `/api/drivers/:id` | Admin/Manager | Update driver |
| DELETE | `/api/drivers/:id` | Admin | Delete driver |

### Trips
| Method | URL | Access | Description |
|--------|-----|--------|-------------|
| GET | `/api/trips` | Auth | List trips |
| GET | `/api/trips/:id` | Auth | Get trip |
| POST | `/api/trips` | Admin/Manager | Create trip → sets vehicle to "On Trip" |
| PUT | `/api/trips/:id` | Admin/Manager | Update trip → on complete, updates odometer |
| DELETE | `/api/trips/:id` | Admin | Delete trip |

### Maintenance
| Method | URL | Access | Description |
|--------|-----|--------|-------------|
| GET | `/api/maintenance` | Auth | List maintenance records |
| GET | `/api/maintenance/:id` | Auth | Get record |
| POST | `/api/maintenance` | Admin/Manager | Create record |
| PUT | `/api/maintenance/:id` | Auth | Update record |
| DELETE | `/api/maintenance/:id` | Admin | Delete record |
| GET | `/api/maintenance/upcoming/list` | Auth | Upcoming maintenance |
| GET | `/api/maintenance/assigned/me` | Auth | My assigned work |

### Repairs
| Method | URL | Access | Description |
|--------|-----|--------|-------------|
| GET | `/api/repairs` | Auth | List repairs |
| GET | `/api/repairs/:id` | Auth | Get repair |
| POST | `/api/repairs` | Admin/Manager | Create repair → sets vehicle to "Under Maintenance" |
| PUT | `/api/repairs/:id` | Auth | Update repair |
| PUT | `/api/repairs/:id/complete` | Auth | Complete repair → sets vehicle to "Available" |
| DELETE | `/api/repairs/:id` | Admin | Delete repair |

### Forecast
| Method | URL | Access | Description |
|--------|-----|--------|-------------|
| GET | `/api/forecast` | Auth | List all forecasts |
| GET | `/api/forecast/:vehicleId` | Auth | Forecast for one vehicle |
| POST | `/api/forecast/generate` | Admin/Manager | Regenerate forecasts from live data |

### Alerts
| Method | URL | Access | Description |
|--------|-----|--------|-------------|
| GET | `/api/alerts` | Auth | List alerts |
| PUT | `/api/alerts/:id/read` | Auth | Mark alert as read |
| PUT | `/api/alerts/:id/resolve` | Auth | Resolve alert |
| PUT | `/api/alerts/read-all` | Auth | Mark all as read |
| DELETE | `/api/alerts/:id` | Admin | Delete alert |
| POST | `/api/alerts/generate` | Admin/Manager | Regenerate alerts from fleet conditions |

### Dashboard
| Method | URL | Access | Description |
|--------|-----|--------|-------------|
| GET | `/api/dashboard/stats` | Auth | Summary statistics |
| GET | `/api/dashboard/charts` | Auth | Chart data series |
| GET | `/api/dashboard/tables` | Auth | Table data |

### Reports
| Method | URL | Access | Description |
|--------|-----|--------|-------------|
| GET | `/api/reports/maintenance-history` | Admin/Manager | Maintenance history report |
| GET | `/api/reports/repair-history` | Admin/Manager | Repair history report |
| GET | `/api/reports/maintenance-costs` | Admin/Manager | Maintenance cost report |
| GET | `/api/reports/repair-costs` | Admin/Manager | Repair cost report |
| GET | `/api/reports/utilisation` | Admin/Manager | Vehicle utilisation report |
| GET | `/api/reports/availability` | Admin/Manager | Fleet availability |
| GET | `/api/reports/upcoming-maintenance` | Admin/Manager | Upcoming services |
| GET | `/api/reports/overdue-maintenance` | Admin/Manager | Overdue services |
| GET | `/api/reports/repair-downtime` | Admin/Manager | Repair downtime |

### Users (Admin only)
| Method | URL | Access | Description |
|--------|-----|--------|-------------|
| GET | `/api/users` | Admin | List all users |
| GET | `/api/users/:id` | Admin | Get user |
| POST | `/api/users` | Admin | Create user (any role) |
| PUT | `/api/users/:id` | Admin | Update user |
| DELETE | `/api/users/:id` | Admin | Delete user |

---

## Forecasting Algorithm

The forecast engine uses **only data from the database** — nothing is random.

### For each vehicle:

**Step 1 — Average Daily Distance**
```
avg_daily_km = total completed trip distance / days covered (last 180 days)
Fallback: current_odometer / vehicle age in days
```

**Step 2 — Service Interval**
```
From service_types table (e.g. "Routine Service" = 10,000 km / 180 days)
Blended 50/50 with this vehicle's observed real-world cadence if ≥2 records exist
```

**Step 3 — Predicted Service Odometer**
```
predicted_odometer = last_service_odometer + service_interval_km
```

**Step 4 — Kilometre-Based Days Until Service**
```
days_by_km = (predicted_odometer - current_odometer) / avg_daily_km
```

**Step 5 — Calendar-Based Days Until Service**
```
days_by_date = (last_service_date + service_interval_days) - today
```

**Step 6 — Binding Constraint (whichever comes first)**
```
days_until_service = min(days_by_km, days_by_date)
predicted_service_date = today + days_until_service
```

**Step 7 — Risk Level**
| Condition | Risk |
|-----------|------|
| Service overdue (days < 0) | 🔴 CRITICAL |
| Due within 15 days | 🟠 HIGH |
| Due within 30 days | 🟡 MEDIUM |
| More than 30 days away | 🟢 LOW |

> Vehicles with 3+ repairs in the last 365 days are escalated one risk level.  
> Vehicles with status "Out of Service" are always CRITICAL.

---

## Project Folder Structure

```
DB/
├── database.sql              ← Import this into MySQL first
├── README.md                 ← This file
│
├── backend/
│   ├── server.js             ← Express app entry point
│   ├── .env                  ← Environment variables (DB credentials, JWT secret)
│   ├── package.json
│   │
│   ├── config/
│   │   └── db.js             ← MySQL connection pool
│   │
│   ├── controllers/          ← Route handlers (one per resource)
│   │   ├── authController.js
│   │   ├── vehicleController.js
│   │   ├── driverController.js
│   │   ├── tripController.js
│   │   ├── maintenanceController.js
│   │   ├── repairController.js
│   │   ├── forecastController.js
│   │   ├── alertController.js
│   │   ├── dashboardController.js
│   │   ├── userController.js
│   │   └── reportController.js
│   │
│   ├── models/               ← Database query methods (one per table)
│   │   ├── userModel.js
│   │   ├── vehicleModel.js
│   │   ├── driverModel.js
│   │   ├── tripModel.js
│   │   ├── maintenanceModel.js
│   │   ├── repairModel.js
│   │   ├── forecastModel.js
│   │   └── alertModel.js
│   │
│   ├── routes/               ← Express routers with middleware chains
│   │   ├── authRoutes.js
│   │   ├── vehicleRoutes.js
│   │   ├── driverRoutes.js
│   │   ├── tripRoutes.js
│   │   ├── maintenanceRoutes.js
│   │   ├── repairRoutes.js
│   │   ├── forecastRoutes.js
│   │   ├── alertRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── userRoutes.js
│   │   └── reportRoutes.js
│   │
│   ├── middleware/
│   │   ├── authMiddleware.js  ← JWT verification, token signing
│   │   ├── roleMiddleware.js  ← Role-based access control
│   │   └── errorMiddleware.js ← Centralised error handler
│   │
│   ├── services/
│   │   ├── forecastService.js ← Maintenance prediction algorithm
│   │   └── alertService.js    ← Automatic alert generation
│   │
│   └── utils/
│       └── validation.js      ← express-validator rule chains
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    │
    └── src/
        ├── App.jsx            ← Routes + app shell layout
        ├── main.jsx           ← React DOM entry
        ├── index.css          ← Design system (tokens, layout, components)
        │
        ├── context/
        │   └── AuthContext.jsx ← Global auth state + login/logout
        │
        ├── services/
        │   └── api.js          ← Axios instance + typed API wrappers
        │
        ├── utils/
        │   └── format.js       ← Date, currency, badge helpers
        │
        ├── components/         ← Shared reusable UI pieces
        │   ├── Navbar.jsx
        │   ├── Sidebar.jsx
        │   ├── ProtectedRoute.jsx
        │   ├── StatCard.jsx
        │   ├── AlertCard.jsx
        │   ├── DataTable.jsx
        │   ├── Modal.jsx
        │   ├── Pagination.jsx
        │   ├── Loader.jsx
        │   └── Banner.jsx
        │
        └── pages/              ← Full page components
            ├── Login.jsx
            ├── Register.jsx
            ├── Dashboard.jsx
            ├── Vehicles.jsx
            ├── VehicleDetails.jsx
            ├── Availability.jsx
            ├── Drivers.jsx
            ├── Trips.jsx
            ├── Maintenance.jsx
            ├── Repairs.jsx
            ├── MyWork.jsx      ← Technician work queue
            ├── Forecast.jsx
            ├── Alerts.jsx
            ├── Reports.jsx
            ├── Users.jsx
            └── Settings.jsx
```

---

## Security

- Passwords hashed with **bcrypt** (cost factor 10)
- JWT tokens expire after **8 hours**
- All queries use **parameterised statements** (no SQL injection)
- **Helmet** sets security headers
- **CORS** restricted to `http://localhost:5173`
- Role checks enforced on every protected route
- No secrets stored in source code — all in `.env`

---

## Troubleshooting

### "ECONNREFUSED" on backend start
→ MySQL is not running. Start MySQL service in Windows Services, XAMPP panel, or via `net start MySQL80`.

### "Access denied for user 'root'"
→ Wrong password in `backend/.env`. Update `DB_PASSWORD` to match your MySQL root password.

### "Unknown database 'fleet_maintenance'"
→ You haven't imported `database.sql` yet. Follow the [Database Setup](#database-setup) steps.

### Frontend shows blank page
→ Make sure both the backend (port 5000) AND frontend (port 5173) are running in separate terminals.

### Charts not loading
→ Click the **"Refresh Engines"** button on the Dashboard to generate forecasts and alerts for the first time.

---

## API Documentation

See [API_DOCS.md](./API_DOCS.md) for detailed endpoint documentation with request/response examples.
