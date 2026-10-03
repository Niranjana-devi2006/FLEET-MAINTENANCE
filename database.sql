-- ============================================================================
-- Fleet Maintenance Forecast System
-- Full database schema + sample data
-- MySQL 8.0+
--
-- Run with:  mysql -u root -p < database.sql
-- ============================================================================

DROP DATABASE IF EXISTS fleet_maintenance;
CREATE DATABASE fleet_maintenance
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE fleet_maintenance;

-- ============================================================================
-- 1. users
-- ============================================================================
CREATE TABLE users (
  user_id     INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL,
  email       VARCHAR(150)  NOT NULL UNIQUE,
  password    VARCHAR(255)  NOT NULL,
  role        ENUM('Admin','Fleet Manager','Technician') NOT NULL DEFAULT 'Fleet Manager',
  phone       VARCHAR(20)   NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_users_email CHECK (email LIKE '%_@_%._%'),
  CONSTRAINT chk_users_name  CHECK (CHAR_LENGTH(TRIM(name)) >= 2)
) ENGINE=InnoDB;

CREATE INDEX idx_users_role ON users(role);

-- ============================================================================
-- 2. vehicles
-- ============================================================================
CREATE TABLE vehicles (
  vehicle_id        INT AUTO_INCREMENT PRIMARY KEY,
  vehicle_number    VARCHAR(30)  NOT NULL UNIQUE,
  vehicle_type      VARCHAR(50)  NOT NULL,
  manufacturer      VARCHAR(80)  NOT NULL,
  model             VARCHAR(80)  NOT NULL,
  purchase_date     DATE         NULL,
  registration_date DATE         NULL,
  current_odometer  INT          NOT NULL DEFAULT 0,
  fuel_type         ENUM('Petrol','Diesel','CNG','Electric','Hybrid') NOT NULL DEFAULT 'Diesel',
  status            ENUM('Available','On Trip','Under Maintenance','Out of Service')
                      NOT NULL DEFAULT 'Available',
  last_service_date DATE         NULL,
  next_service_date DATE         NULL,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_vehicles_odo    CHECK (current_odometer >= 0),
  CONSTRAINT chk_vehicles_number CHECK (CHAR_LENGTH(TRIM(vehicle_number)) >= 3)
) ENGINE=InnoDB;

CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_vehicles_next_service ON vehicles(next_service_date);

-- ============================================================================
-- 3. drivers
-- ============================================================================
CREATE TABLE drivers (
  driver_id      INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  license_number VARCHAR(40)  NOT NULL UNIQUE,
  phone          VARCHAR(20)  NULL,
  license_expiry DATE         NULL,
  status         ENUM('Active','On Trip','Inactive','Suspended') NOT NULL DEFAULT 'Active',
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_drivers_name CHECK (CHAR_LENGTH(TRIM(name)) >= 2)
) ENGINE=InnoDB;

CREATE INDEX idx_drivers_status ON drivers(status);
CREATE INDEX idx_drivers_expiry ON drivers(license_expiry);

-- ============================================================================
-- 4. service_types
-- ============================================================================
CREATE TABLE service_types (
  service_type_id       INT AUTO_INCREMENT PRIMARY KEY,
  service_name          VARCHAR(80) NOT NULL UNIQUE,
  service_interval_km   INT NOT NULL,
  service_interval_days INT NOT NULL,
  description           VARCHAR(255) NULL,
  CONSTRAINT chk_st_km   CHECK (service_interval_km > 0),
  CONSTRAINT chk_st_days CHECK (service_interval_days > 0)
) ENGINE=InnoDB;

-- ============================================================================
-- 5. trips
-- ============================================================================
CREATE TABLE trips (
  trip_id        INT AUTO_INCREMENT PRIMARY KEY,
  vehicle_id     INT NOT NULL,
  driver_id      INT NOT NULL,
  start_location VARCHAR(120) NOT NULL,
  destination    VARCHAR(120) NOT NULL,
  start_date     DATE NOT NULL,
  end_date       DATE NULL,
  distance_km    DECIMAL(10,2) NOT NULL DEFAULT 0,
  fuel_consumed  DECIMAL(10,2) NOT NULL DEFAULT 0,
  trip_status    ENUM('Scheduled','Ongoing','Completed','Cancelled') NOT NULL DEFAULT 'Scheduled',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_trips_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_trips_driver  FOREIGN KEY (driver_id)  REFERENCES drivers(driver_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_trips_distance CHECK (distance_km >= 0),
  CONSTRAINT chk_trips_fuel     CHECK (fuel_consumed >= 0),
  CONSTRAINT chk_trips_dates    CHECK (end_date IS NULL OR end_date >= start_date)
) ENGINE=InnoDB;

CREATE INDEX idx_trips_vehicle ON trips(vehicle_id);
CREATE INDEX idx_trips_driver  ON trips(driver_id);
CREATE INDEX idx_trips_status  ON trips(trip_status);
CREATE INDEX idx_trips_start   ON trips(start_date);

-- ============================================================================
-- 6. maintenance
-- ============================================================================
CREATE TABLE maintenance (
  maintenance_id        INT AUTO_INCREMENT PRIMARY KEY,
  vehicle_id            INT NOT NULL,
  maintenance_type      VARCHAR(80) NOT NULL,
  service_date          DATE NOT NULL,
  odometer_reading      INT NOT NULL DEFAULT 0,
  description           VARCHAR(500) NULL,
  service_cost          DECIMAL(12,2) NOT NULL DEFAULT 0,
  next_service_date     DATE NULL,
  next_service_odometer INT NULL,
  status                ENUM('Scheduled','In Progress','Completed','Cancelled')
                          NOT NULL DEFAULT 'Scheduled',
  technician            VARCHAR(100) NULL,
  remarks               VARCHAR(500) NULL,
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_maint_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_maint_cost     CHECK (service_cost >= 0),
  CONSTRAINT chk_maint_odo      CHECK (odometer_reading >= 0),
  CONSTRAINT chk_maint_next_odo CHECK (next_service_odometer IS NULL OR next_service_odometer >= 0)
) ENGINE=InnoDB;

CREATE INDEX idx_maint_vehicle ON maintenance(vehicle_id);
CREATE INDEX idx_maint_status  ON maintenance(status);
CREATE INDEX idx_maint_date    ON maintenance(service_date);

-- ============================================================================
-- 7. repairs
-- ============================================================================
CREATE TABLE repairs (
  repair_id           INT AUTO_INCREMENT PRIMARY KEY,
  vehicle_id          INT NOT NULL,
  repair_date         DATE NOT NULL,
  problem_description VARCHAR(500) NOT NULL,
  repair_description  VARCHAR(500) NULL,
  parts_replaced      VARCHAR(500) NULL,
  repair_cost         DECIMAL(12,2) NOT NULL DEFAULT 0,
  downtime_hours      DECIMAL(8,2) NOT NULL DEFAULT 0,
  technician          VARCHAR(100) NULL,
  status              ENUM('Open','In Progress','Completed','Cancelled') NOT NULL DEFAULT 'Open',
  remarks             VARCHAR(500) NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_repair_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_repair_cost     CHECK (repair_cost >= 0),
  CONSTRAINT chk_repair_downtime CHECK (downtime_hours >= 0)
) ENGINE=InnoDB;

CREATE INDEX idx_repair_vehicle ON repairs(vehicle_id);
CREATE INDEX idx_repair_status  ON repairs(status);
CREATE INDEX idx_repair_date    ON repairs(repair_date);

-- ============================================================================
-- 8. maintenance_forecast
-- ============================================================================
CREATE TABLE maintenance_forecast (
  forecast_id            INT AUTO_INCREMENT PRIMARY KEY,
  vehicle_id             INT NOT NULL,
  predicted_service_date DATE NOT NULL,
  predicted_odometer     INT NOT NULL,
  maintenance_type       VARCHAR(80) NOT NULL,
  risk_level             ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'LOW',
  reason                 VARCHAR(500) NULL,
  avg_daily_km           DECIMAL(10,2) NOT NULL DEFAULT 0,
  days_until_service     INT NOT NULL DEFAULT 0,
  generated_date         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_forecast_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_forecast_odo CHECK (predicted_odometer >= 0)
) ENGINE=InnoDB;

CREATE INDEX idx_forecast_vehicle ON maintenance_forecast(vehicle_id);
CREATE INDEX idx_forecast_risk    ON maintenance_forecast(risk_level);
CREATE INDEX idx_forecast_gen     ON maintenance_forecast(generated_date);

-- ============================================================================
-- 9. alerts
-- ============================================================================
CREATE TABLE alerts (
  alert_id      INT AUTO_INCREMENT PRIMARY KEY,
  vehicle_id    INT NULL,
  alert_type    VARCHAR(60) NOT NULL,
  alert_message VARCHAR(500) NOT NULL,
  alert_date    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  priority      ENUM('Low','Medium','High','Critical') NOT NULL DEFAULT 'Low',
  status        ENUM('Unread','Read','Resolved') NOT NULL DEFAULT 'Unread',
  CONSTRAINT fk_alerts_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_alerts_status   ON alerts(status);
CREATE INDEX idx_alerts_priority ON alerts(priority);
CREATE INDEX idx_alerts_vehicle  ON alerts(vehicle_id);

-- ============================================================================
-- SAMPLE DATA
-- Passwords (bcrypt, cost 10):
--   admin@fleet.com    -> Admin@123
--   manager@fleet.com  -> Manager@123
--   tech@fleet.com     -> Tech@123
-- ============================================================================

INSERT INTO users (name, email, password, role, phone) VALUES
('Ravi Kumar',   'admin@fleet.com',    '$2a$10$TTdqoJmkogEJ3/ykd0Tl/.YrNaJVGDRXTnKvp2c3iIUdfrRfHW0/G', 'Admin',         '+91-9876543210'),
('Priya Sharma', 'manager@fleet.com',  '$2a$10$vbHMAvC2xfVJZyeT80YIreKWqFzzPli1QRGs7Li.j45iqFzKSdIv.', 'Fleet Manager', '+91-9876543211'),
('Arun Mehta',   'tech@fleet.com',     '$2a$10$DcEwMeQ8PdoJXZJ.92TINu9IpdLshldtjF.03B.zgvkSgkfrx1Dq6', 'Technician',    '+91-9876543212'),
('Sneha Iyer',   'manager2@fleet.com', '$2a$10$vbHMAvC2xfVJZyeT80YIreKWqFzzPli1QRGs7Li.j45iqFzKSdIv.', 'Fleet Manager', '+91-9876543213'),
('Vikram Singh', 'tech2@fleet.com',    '$2a$10$DcEwMeQ8PdoJXZJ.92TINu9IpdLshldtjF.03B.zgvkSgkfrx1Dq6', 'Technician',    '+91-9876543214');

-- ---------------------------------------------------------------------------
INSERT INTO service_types (service_name, service_interval_km, service_interval_days, description) VALUES
('Routine Service',      10000, 180, 'General inspection, filters, fluid top-up'),
('Oil Change',            8000,  90, 'Engine oil and oil filter replacement'),
('Brake Inspection',     15000, 240, 'Brake pads, discs and fluid inspection'),
('Tyre Rotation',        12000, 180, 'Rotate and balance all tyres'),
('Full Service',         20000, 365, 'Comprehensive annual service'),
('Transmission Service', 40000, 730, 'Gearbox oil and clutch inspection'),
('Coolant Flush',        30000, 540, 'Radiator flush and coolant replacement'),
('Air Filter Change',     6000, 120, 'Engine and cabin air filter replacement');

-- ---------------------------------------------------------------------------
-- Vehicles. Odometer + last service dates are tuned so the forecast engine
-- produces a realistic spread of LOW / MEDIUM / HIGH / CRITICAL risk levels
-- immediately after seeding.
INSERT INTO vehicles
  (vehicle_number, vehicle_type, manufacturer, model, purchase_date, registration_date,
   current_odometer, fuel_type, status, last_service_date, next_service_date) VALUES
('KA01AB1234','Truck',    'Tata',         'LPT 1618',    '2021-03-15','2021-03-20', 148500,'Diesel',  'Available',         DATE_SUB(CURDATE(), INTERVAL 175 DAY), DATE_ADD(CURDATE(), INTERVAL 5 DAY)),
('KA01CD5678','Van',      'Mahindra',     'Supro Maxi',  '2022-06-10','2022-06-15',  76200,'Diesel',  'On Trip',           DATE_SUB(CURDATE(), INTERVAL 92 DAY),  DATE_ADD(CURDATE(), INTERVAL 88 DAY)),
('KA02EF9012','Truck',    'Ashok Leyland','Boss 1115',   '2020-01-20','2020-01-28', 219400,'Diesel',  'Under Maintenance', DATE_SUB(CURDATE(), INTERVAL 210 DAY), DATE_SUB(CURDATE(), INTERVAL 30 DAY)),
('KA02GH3456','Car',      'Maruti Suzuki','Dzire',       '2023-02-05','2023-02-10',  41800,'Petrol',  'Available',         DATE_SUB(CURDATE(), INTERVAL 40 DAY),  DATE_ADD(CURDATE(), INTERVAL 140 DAY)),
('KA03IJ7890','Bus',      'Tata',         'Starbus 32',  '2019-11-11','2019-11-18', 305600,'Diesel',  'On Trip',           DATE_SUB(CURDATE(), INTERVAL 120 DAY), DATE_ADD(CURDATE(), INTERVAL 12 DAY)),
('KA03KL1122','Pickup',   'Isuzu',        'D-Max S-Cab', '2022-09-01','2022-09-08',  63900,'Diesel',  'Available',         DATE_SUB(CURDATE(), INTERVAL 65 DAY),  DATE_ADD(CURDATE(), INTERVAL 25 DAY)),
('KA04MN3344','Van',      'Force',        'Traveller 26','2021-07-22','2021-07-30', 132700,'Diesel',  'Available',         DATE_SUB(CURDATE(), INTERVAL 150 DAY), DATE_ADD(CURDATE(), INTERVAL 30 DAY)),
('KA04OP5566','Truck',    'BharatBenz',   '1917R',       '2020-05-14','2020-05-22', 187300,'Diesel',  'Out of Service',    DATE_SUB(CURDATE(), INTERVAL 260 DAY), DATE_SUB(CURDATE(), INTERVAL 80 DAY)),
('KA05QR7788','Car',      'Hyundai',      'Aura',        '2023-08-19','2023-08-25',  28450,'CNG',     'Available',         DATE_SUB(CURDATE(), INTERVAL 20 DAY),  DATE_ADD(CURDATE(), INTERVAL 160 DAY)),
('KA05ST9900','Electric', 'Tata',         'Ace EV',      '2024-01-10','2024-01-15',  18900,'Electric','Available',         DATE_SUB(CURDATE(), INTERVAL 55 DAY),  DATE_ADD(CURDATE(), INTERVAL 125 DAY)),
('KA06UV2233','Truck',    'Eicher',       'Pro 2049',    '2021-12-03','2021-12-10', 111250,'Diesel',  'Under Maintenance', DATE_SUB(CURDATE(), INTERVAL 190 DAY), DATE_SUB(CURDATE(), INTERVAL 10 DAY)),
('KA06WX4455','Bus',      'Volvo',        '9600 Coach',  '2022-04-27','2022-05-04',  95800,'Diesel',  'Available',         DATE_SUB(CURDATE(), INTERVAL 88 DAY),  DATE_ADD(CURDATE(), INTERVAL 92 DAY));

-- ---------------------------------------------------------------------------
INSERT INTO drivers (name, license_number, phone, license_expiry, status) VALUES
('Suresh Naidu',  'DL-KA-2019-004512', '+91-9812345601', DATE_ADD(CURDATE(), INTERVAL 400 DAY), 'Active'),
('Manoj Pillai',  'DL-KA-2018-009834', '+91-9812345602', DATE_ADD(CURDATE(), INTERVAL 18 DAY),  'On Trip'),
('Rahul Verma',   'DL-KA-2020-001276', '+91-9812345603', DATE_SUB(CURDATE(), INTERVAL 12 DAY),  'Active'),
('Deepak Rao',    'DL-KA-2017-007745', '+91-9812345604', DATE_ADD(CURDATE(), INTERVAL 220 DAY), 'On Trip'),
('Imran Khan',    'DL-KA-2021-003398', '+91-9812345605', DATE_ADD(CURDATE(), INTERVAL 25 DAY),  'Active'),
('Ganesh Murthy', 'DL-KA-2016-005521', '+91-9812345606', DATE_ADD(CURDATE(), INTERVAL 640 DAY), 'Active'),
('Lakshmi Devi',  'DL-KA-2022-008812', '+91-9812345607', DATE_ADD(CURDATE(), INTERVAL 510 DAY), 'Active'),
('Farhan Ali',    'DL-KA-2019-002143', '+91-9812345608', DATE_ADD(CURDATE(), INTERVAL 75 DAY),  'Inactive');

-- ---------------------------------------------------------------------------
-- Trips: recent history drives the average-daily-distance calculation used by
-- the forecasting service.
INSERT INTO trips (vehicle_id, driver_id, start_location, destination, start_date, end_date, distance_km, fuel_consumed, trip_status) VALUES
(1,1,'Bengaluru','Chennai',          DATE_SUB(CURDATE(), INTERVAL 84 DAY), DATE_SUB(CURDATE(), INTERVAL 83 DAY), 350.00, 62.50,'Completed'),
(1,1,'Chennai','Bengaluru',          DATE_SUB(CURDATE(), INTERVAL 78 DAY), DATE_SUB(CURDATE(), INTERVAL 77 DAY), 348.00, 61.80,'Completed'),
(1,6,'Bengaluru','Hyderabad',        DATE_SUB(CURDATE(), INTERVAL 62 DAY), DATE_SUB(CURDATE(), INTERVAL 60 DAY), 570.00,103.20,'Completed'),
(1,6,'Hyderabad','Bengaluru',        DATE_SUB(CURDATE(), INTERVAL 55 DAY), DATE_SUB(CURDATE(), INTERVAL 53 DAY), 572.00,104.10,'Completed'),
(1,1,'Bengaluru','Mangaluru',        DATE_SUB(CURDATE(), INTERVAL 34 DAY), DATE_SUB(CURDATE(), INTERVAL 33 DAY), 352.00, 64.00,'Completed'),
(1,1,'Mangaluru','Bengaluru',        DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_SUB(CURDATE(), INTERVAL 19 DAY), 355.00, 65.30,'Completed'),
(2,2,'Bengaluru','Mysuru',           DATE_SUB(CURDATE(), INTERVAL 70 DAY), DATE_SUB(CURDATE(), INTERVAL 70 DAY), 145.00, 14.20,'Completed'),
(2,2,'Mysuru','Bengaluru',           DATE_SUB(CURDATE(), INTERVAL 66 DAY), DATE_SUB(CURDATE(), INTERVAL 66 DAY), 146.00, 14.50,'Completed'),
(2,2,'Bengaluru','Hosur',            DATE_SUB(CURDATE(), INTERVAL 41 DAY), DATE_SUB(CURDATE(), INTERVAL 41 DAY),  42.00,  4.80,'Completed'),
(2,2,'Bengaluru','Salem',            DATE_SUB(CURDATE(), INTERVAL 2 DAY),  NULL,                                 205.00,  0.00,'Ongoing'),
(3,3,'Bengaluru','Pune',             DATE_SUB(CURDATE(), INTERVAL 96 DAY), DATE_SUB(CURDATE(), INTERVAL 93 DAY), 840.00,158.00,'Completed'),
(3,3,'Pune','Bengaluru',             DATE_SUB(CURDATE(), INTERVAL 88 DAY), DATE_SUB(CURDATE(), INTERVAL 85 DAY), 838.00,157.20,'Completed'),
(3,6,'Bengaluru','Goa',              DATE_SUB(CURDATE(), INTERVAL 60 DAY), DATE_SUB(CURDATE(), INTERVAL 58 DAY), 560.00,106.00,'Completed'),
(3,6,'Goa','Bengaluru',              DATE_SUB(CURDATE(), INTERVAL 45 DAY), DATE_SUB(CURDATE(), INTERVAL 43 DAY), 562.00,107.50,'Completed'),
(4,5,'Bengaluru','Tumakuru',         DATE_SUB(CURDATE(), INTERVAL 30 DAY), DATE_SUB(CURDATE(), INTERVAL 30 DAY),  72.00,  5.10,'Completed'),
(4,5,'Bengaluru','Kolar',            DATE_SUB(CURDATE(), INTERVAL 22 DAY), DATE_SUB(CURDATE(), INTERVAL 22 DAY),  70.00,  5.00,'Completed'),
(4,7,'Bengaluru','Mysuru',           DATE_SUB(CURDATE(), INTERVAL 9 DAY),  DATE_SUB(CURDATE(), INTERVAL 9 DAY),  147.00, 10.40,'Completed'),
(5,4,'Bengaluru','Chennai',          DATE_SUB(CURDATE(), INTERVAL 75 DAY), DATE_SUB(CURDATE(), INTERVAL 74 DAY), 349.00, 78.20,'Completed'),
(5,4,'Chennai','Bengaluru',          DATE_SUB(CURDATE(), INTERVAL 68 DAY), DATE_SUB(CURDATE(), INTERVAL 67 DAY), 351.00, 79.00,'Completed'),
(5,4,'Bengaluru','Coimbatore',       DATE_SUB(CURDATE(), INTERVAL 40 DAY), DATE_SUB(CURDATE(), INTERVAL 39 DAY), 365.00, 82.60,'Completed'),
(5,4,'Coimbatore','Bengaluru',       DATE_SUB(CURDATE(), INTERVAL 25 DAY), DATE_SUB(CURDATE(), INTERVAL 24 DAY), 366.00, 83.10,'Completed'),
(5,4,'Bengaluru','Vijayawada',       DATE_SUB(CURDATE(), INTERVAL 1 DAY),  NULL,                                 610.00,  0.00,'Ongoing'),
(6,7,'Bengaluru','Nelamangala',      DATE_SUB(CURDATE(), INTERVAL 50 DAY), DATE_SUB(CURDATE(), INTERVAL 50 DAY),  35.00,  3.20,'Completed'),
(6,7,'Bengaluru','Hassan',           DATE_SUB(CURDATE(), INTERVAL 33 DAY), DATE_SUB(CURDATE(), INTERVAL 32 DAY), 185.00, 17.80,'Completed'),
(6,7,'Hassan','Bengaluru',           DATE_SUB(CURDATE(), INTERVAL 15 DAY), DATE_SUB(CURDATE(), INTERVAL 14 DAY), 186.00, 18.10,'Completed'),
(7,1,'Bengaluru','Belagavi',         DATE_SUB(CURDATE(), INTERVAL 58 DAY), DATE_SUB(CURDATE(), INTERVAL 56 DAY), 505.00, 68.00,'Completed'),
(7,1,'Belagavi','Bengaluru',         DATE_SUB(CURDATE(), INTERVAL 47 DAY), DATE_SUB(CURDATE(), INTERVAL 45 DAY), 507.00, 68.90,'Completed'),
(7,6,'Bengaluru','Davangere',        DATE_SUB(CURDATE(), INTERVAL 18 DAY), DATE_SUB(CURDATE(), INTERVAL 17 DAY), 265.00, 36.20,'Completed'),
(9,5,'Bengaluru','Airport',          DATE_SUB(CURDATE(), INTERVAL 12 DAY), DATE_SUB(CURDATE(), INTERVAL 12 DAY),  40.00,  3.00,'Completed'),
(9,5,'Bengaluru','Whitefield',       DATE_SUB(CURDATE(), INTERVAL 5 DAY),  DATE_SUB(CURDATE(), INTERVAL 5 DAY),   28.00,  2.10,'Completed'),
(10,7,'Bengaluru','Electronic City', DATE_SUB(CURDATE(), INTERVAL 8 DAY),  DATE_SUB(CURDATE(), INTERVAL 8 DAY),   32.00,  0.00,'Completed'),
(11,3,'Bengaluru','Shivamogga',      DATE_SUB(CURDATE(), INTERVAL 72 DAY), DATE_SUB(CURDATE(), INTERVAL 70 DAY), 305.00, 44.50,'Completed'),
(11,3,'Shivamogga','Bengaluru',      DATE_SUB(CURDATE(), INTERVAL 63 DAY), DATE_SUB(CURDATE(), INTERVAL 61 DAY), 307.00, 45.10,'Completed'),
(12,4,'Bengaluru','Chennai',         DATE_SUB(CURDATE(), INTERVAL 36 DAY), DATE_SUB(CURDATE(), INTERVAL 35 DAY), 348.00, 71.00,'Completed'),
(12,4,'Chennai','Bengaluru',         DATE_SUB(CURDATE(), INTERVAL 28 DAY), DATE_SUB(CURDATE(), INTERVAL 27 DAY), 350.00, 71.80,'Completed'),
(12,6,'Bengaluru','Tirupati',        DATE_ADD(CURDATE(), INTERVAL 3 DAY),  NULL,                                 250.00,  0.00,'Scheduled');

-- ---------------------------------------------------------------------------
-- Maintenance history: two or more completed services per vehicle so the
-- forecaster can derive a real average distance between services.
INSERT INTO maintenance
  (vehicle_id, maintenance_type, service_date, odometer_reading, description, service_cost,
   next_service_date, next_service_odometer, status, technician, remarks) VALUES
(1,'Routine Service',  DATE_SUB(CURDATE(), INTERVAL 360 DAY), 128000,'Full inspection, filters replaced',        8400.00, DATE_SUB(CURDATE(), INTERVAL 180 DAY), 138000,'Completed','Arun Mehta','No issues found'),
(1,'Oil Change',       DATE_SUB(CURDATE(), INTERVAL 265 DAY), 136500,'Engine oil + filter',                      3200.00, DATE_SUB(CURDATE(), INTERVAL 175 DAY), 144500,'Completed','Vikram Singh','Synthetic oil used'),
(1,'Routine Service',  DATE_SUB(CURDATE(), INTERVAL 175 DAY), 138900,'Scheduled 10k service',                    9100.00, DATE_ADD(CURDATE(), INTERVAL 5 DAY),   148900,'Completed','Arun Mehta','Brake pads at 40%'),
(2,'Oil Change',       DATE_SUB(CURDATE(), INTERVAL 280 DAY),  58400,'Engine oil + filter',                      2600.00, DATE_SUB(CURDATE(), INTERVAL 190 DAY),  66400,'Completed','Arun Mehta',''),
(2,'Routine Service',  DATE_SUB(CURDATE(), INTERVAL 92 DAY),   70100,'General service',                          6800.00, DATE_ADD(CURDATE(), INTERVAL 88 DAY),   80100,'Completed','Vikram Singh',''),
(3,'Full Service',     DATE_SUB(CURDATE(), INTERVAL 420 DAY), 178000,'Annual comprehensive service',            21500.00, DATE_SUB(CURDATE(), INTERVAL 55 DAY),  198000,'Completed','Arun Mehta','Clutch worn'),
(3,'Routine Service',  DATE_SUB(CURDATE(), INTERVAL 210 DAY), 195200,'10k service',                             10200.00, DATE_SUB(CURDATE(), INTERVAL 30 DAY),  205200,'Completed','Vikram Singh','Overdue at booking'),
(3,'Brake Inspection', DATE_ADD(CURDATE(), INTERVAL 2 DAY),   219400,'Brake overhaul - scheduled',              12000.00, NULL,                                  NULL,  'Scheduled','Arun Mehta','Vehicle in workshop'),
(4,'Oil Change',       DATE_SUB(CURDATE(), INTERVAL 220 DAY),  26800,'Engine oil + filter',                      2200.00, DATE_SUB(CURDATE(), INTERVAL 130 DAY),  34800,'Completed','Vikram Singh',''),
(4,'Routine Service',  DATE_SUB(CURDATE(), INTERVAL 40 DAY),   38900,'10k service',                              5400.00, DATE_ADD(CURDATE(), INTERVAL 140 DAY),  48900,'Completed','Arun Mehta',''),
(5,'Full Service',     DATE_SUB(CURDATE(), INTERVAL 300 DAY), 278000,'Annual service',                          28400.00, DATE_ADD(CURDATE(), INTERVAL 65 DAY),  298000,'Completed','Arun Mehta',''),
(5,'Routine Service',  DATE_SUB(CURDATE(), INTERVAL 120 DAY), 293400,'10k service',                             11800.00, DATE_ADD(CURDATE(), INTERVAL 12 DAY),  303400,'Completed','Vikram Singh','Suspension check advised'),
(6,'Oil Change',       DATE_SUB(CURDATE(), INTERVAL 240 DAY),  48200,'Engine oil + filter',                      2900.00, DATE_SUB(CURDATE(), INTERVAL 150 DAY),  56200,'Completed','Arun Mehta',''),
(6,'Routine Service',  DATE_SUB(CURDATE(), INTERVAL 65 DAY),   57300,'10k service',                              7200.00, DATE_ADD(CURDATE(), INTERVAL 25 DAY),   67300,'Completed','Vikram Singh',''),
(7,'Routine Service',  DATE_SUB(CURDATE(), INTERVAL 330 DAY), 112000,'10k service',                              8900.00, DATE_SUB(CURDATE(), INTERVAL 150 DAY), 122000,'Completed','Arun Mehta',''),
(7,'Routine Service',  DATE_SUB(CURDATE(), INTERVAL 150 DAY), 123100,'10k service',                              9300.00, DATE_ADD(CURDATE(), INTERVAL 30 DAY),  133100,'Completed','Vikram Singh',''),
(8,'Full Service',     DATE_SUB(CURDATE(), INTERVAL 440 DAY), 166000,'Annual service',                          24800.00, DATE_SUB(CURDATE(), INTERVAL 75 DAY),  186000,'Completed','Arun Mehta','Engine noise reported'),
(8,'Routine Service',  DATE_SUB(CURDATE(), INTERVAL 260 DAY), 179500,'10k service',                             10400.00, DATE_SUB(CURDATE(), INTERVAL 80 DAY),  189500,'Completed','Vikram Singh','Overdue - vehicle grounded'),
(9,'Oil Change',       DATE_SUB(CURDATE(), INTERVAL 200 DAY),  15200,'First oil change',                         1900.00, DATE_SUB(CURDATE(), INTERVAL 110 DAY),  23200,'Completed','Arun Mehta',''),
(9,'Routine Service',  DATE_SUB(CURDATE(), INTERVAL 20 DAY),   26900,'10k service',                              4600.00, DATE_ADD(CURDATE(), INTERVAL 160 DAY),  36900,'Completed','Vikram Singh',''),
(10,'Routine Service', DATE_SUB(CURDATE(), INTERVAL 200 DAY),   8400,'EV first service - battery health check',   3200.00, DATE_SUB(CURDATE(), INTERVAL 20 DAY),   18400,'Completed','Arun Mehta','Battery 98% SOH'),
(10,'Routine Service', DATE_SUB(CURDATE(), INTERVAL 55 DAY),   15100,'EV service',                               3400.00, DATE_ADD(CURDATE(), INTERVAL 125 DAY),  25100,'Completed','Vikram Singh',''),
(11,'Routine Service', DATE_SUB(CURDATE(), INTERVAL 370 DAY),  88000,'10k service',                              8100.00, DATE_SUB(CURDATE(), INTERVAL 190 DAY),  98000,'Completed','Arun Mehta',''),
(11,'Routine Service', DATE_SUB(CURDATE(), INTERVAL 190 DAY),  99600,'10k service',                              8700.00, DATE_SUB(CURDATE(), INTERVAL 10 DAY),  109600,'Completed','Vikram Singh','Overdue now'),
(11,'Oil Change',      CURDATE(),                             111250,'Oil change during repair visit',           3300.00, NULL,                                  NULL,  'In Progress','Arun Mehta','In workshop'),
(12,'Routine Service', DATE_SUB(CURDATE(), INTERVAL 268 DAY),  74200,'10k service',                             14200.00, DATE_SUB(CURDATE(), INTERVAL 88 DAY),   84200,'Completed','Arun Mehta',''),
(12,'Routine Service', DATE_SUB(CURDATE(), INTERVAL 88 DAY),   85900,'10k service',                             15100.00, DATE_ADD(CURDATE(), INTERVAL 92 DAY),   95900,'Completed','Vikram Singh','Coach interior refresh');

-- ---------------------------------------------------------------------------
INSERT INTO repairs
  (vehicle_id, repair_date, problem_description, repair_description, parts_replaced,
   repair_cost, downtime_hours, technician, status, remarks) VALUES
(3, DATE_SUB(CURDATE(), INTERVAL 3 DAY),  'Brake fade on descent, pedal travel excessive','Brake caliper overhaul in progress',   'Front brake pads, brake fluid',  18500.00, 46.00,'Arun Mehta',  'In Progress','Awaiting rear disc delivery'),
(11,DATE_SUB(CURDATE(), INTERVAL 6 DAY),  'Coolant leak, engine overheating warning',     'Radiator replacement underway',        'Radiator, upper hose, coolant',  22400.00, 62.00,'Vikram Singh','In Progress','Long downtime - parts backorder'),
(8, DATE_SUB(CURDATE(), INTERVAL 40 DAY), 'Knocking noise from engine at idle',           'Awaiting engine teardown estimate',    '',                                   0.00,  0.00,'Arun Mehta',  'Open',       'Vehicle out of service'),
(1, DATE_SUB(CURDATE(), INTERVAL 58 DAY), 'Alternator not charging',                      'Alternator replaced and tested',       'Alternator, drive belt',          9800.00, 14.00,'Vikram Singh','Completed',  'Resolved'),
(2, DATE_SUB(CURDATE(), INTERVAL 110 DAY),'Clutch slipping under load',                   'Clutch plate assembly replaced',       'Clutch plate, pressure plate',   14200.00, 26.00,'Arun Mehta',  'Completed',  'Resolved'),
(5, DATE_SUB(CURDATE(), INTERVAL 78 DAY), 'AC not cooling in passenger cabin',            'Compressor reseal and regas',          'AC compressor seal, refrigerant', 7600.00, 10.00,'Vikram Singh','Completed',  'Resolved'),
(5, DATE_SUB(CURDATE(), INTERVAL 32 DAY), 'Suspension noise over speed breakers',         'Leaf spring bush replacement',         'Leaf spring bushes x4',           5400.00,  8.00,'Arun Mehta',  'Completed',  'Resolved'),
(7, DATE_SUB(CURDATE(), INTERVAL 95 DAY), 'Headlamp assembly cracked after debris hit',   'Headlamp assembly replaced',           'RH headlamp assembly',            4300.00,  5.00,'Vikram Singh','Completed',  'Resolved'),
(3, DATE_SUB(CURDATE(), INTERVAL 130 DAY),'Gearbox hard shifting into 3rd',               'Gearbox oil flush and linkage adjust', 'Gear oil, linkage bushes',        6900.00, 18.00,'Arun Mehta',  'Completed',  'Resolved'),
(4, DATE_SUB(CURDATE(), INTERVAL 66 DAY), 'Battery draining overnight',                   'Battery replaced, parasitic draw fixed','Battery 12V 65Ah',               6200.00,  6.00,'Vikram Singh','Completed',  'Resolved'),
(12,DATE_SUB(CURDATE(), INTERVAL 51 DAY), 'Door actuator failure on entry door',          'Pneumatic actuator replaced',          'Door actuator, air line',        11800.00, 12.00,'Arun Mehta',  'Completed',  'Resolved'),
(6, DATE_SUB(CURDATE(), INTERVAL 24 DAY), 'Tyre puncture and rim damage',                 'Tyre and rim replaced',                'Tyre 215/75 R15, steel rim',      9100.00,  4.00,'Vikram Singh','Completed',  'Resolved');

-- ---------------------------------------------------------------------------
-- Seed alerts. The alert service regenerates these from live fleet conditions
-- on every dashboard load, so this is only a starting snapshot.
INSERT INTO alerts (vehicle_id, alert_type, alert_message, alert_date, priority, status) VALUES
(3, 'Maintenance Overdue', 'KA02EF9012: service was due 30 days ago - vehicle in workshop',     DATE_SUB(NOW(), INTERVAL 2 DAY),'Critical','Unread'),
(8, 'Vehicle Unavailable', 'KA04OP5566 is Out of Service pending engine assessment',            DATE_SUB(NOW(), INTERVAL 5 DAY),'Critical','Unread'),
(11,'Long Repair Downtime','KA06UV2233 has accumulated 62 downtime hours on an open repair',    DATE_SUB(NOW(), INTERVAL 1 DAY),'High','Unread'),
(1, 'Maintenance Due',     'KA01AB1234: next service due in 5 days',                            DATE_SUB(NOW(), INTERVAL 1 DAY),'High','Unread'),
(5, 'High Mileage',        'KA03IJ7890 has crossed 300,000 km - schedule major inspection',     DATE_SUB(NOW(), INTERVAL 3 DAY),'Medium','Read'),
(6, 'Upcoming Service',    'KA03KL1122: service scheduled in 25 days',                          DATE_SUB(NOW(), INTERVAL 4 DAY),'Low','Read');

-- ============================================================================
-- Done. Forecast rows are generated on demand by the backend forecast service
-- (POST /api/forecast/generate), which reads the trip + maintenance history
-- inserted above.
-- ============================================================================
SELECT 'fleet_maintenance database created successfully' AS status;
