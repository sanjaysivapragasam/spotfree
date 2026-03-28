-- ─────────────────────────────────────────────────────────────
-- SpotFree - Initial Database Schema
-- ─────────────────────────────────────────────────────────────

-- Users
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(150) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Parking Lots (each lot is a "facility" with many spaces)
CREATE TABLE IF NOT EXISTS parking_lots (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    location    VARCHAR(255) NOT NULL,
    total_spaces INT NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- parking lot to space is 1 to many relationship
-- Individual Parking Spaces inside a lot
CREATE TABLE IF NOT EXISTS parking_spaces (
    id          SERIAL PRIMARY KEY,
    lot_id      INT REFERENCES parking_lots(id) ON DELETE CASCADE,
    space_number VARCHAR(10) NOT NULL,   -- e.g. "A1", "B4"
    is_occupied BOOLEAN DEFAULT FALSE,
    space_type  VARCHAR(20) DEFAULT 'standard'  -- standard, accessible, ev
);

-- Reservations
CREATE TABLE IF NOT EXISTS reservations (
    id          SERIAL PRIMARY KEY,
    user_id     INT REFERENCES users(id),
    space_id    INT REFERENCES parking_spaces(id),
    start_time  TIMESTAMP NOT NULL,
    end_time    TIMESTAMP NOT NULL,
    status      VARCHAR(20) DEFAULT 'active',  -- active, completed, cancelled
    total_price NUMERIC(8,2),
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Pricing Rules
CREATE TABLE IF NOT EXISTS pricing_rules (
    id          SERIAL PRIMARY KEY,
    lot_id      INT REFERENCES parking_lots(id),
    base_rate   NUMERIC(8,2) NOT NULL,   -- $ per hour
    peak_rate   NUMERIC(8,2) NOT NULL,   -- $ per hour during peak
    peak_start  INT DEFAULT 8,           -- hour of day (24h)
    peak_end    INT DEFAULT 18
);

-- ─── Seed Data (so the app has something to show immediately) ───────────────

INSERT INTO parking_lots (name, location, total_spaces) VALUES
    ('Downtown Lot A', '123 Main St', 20),
    ('Mall Parking',   '456 King St', 50),
    ('Airport P1',     '789 Airport Rd', 100);

INSERT INTO parking_spaces (lot_id, space_number, is_occupied, space_type)
SELECT
    1,
    'A' || gs,
    CASE WHEN gs IN (2, 5, 9, 14, 18) THEN TRUE ELSE FALSE END,
    CASE
        WHEN gs IN (4, 12) THEN 'ev'
        WHEN gs IN (5, 15) THEN 'accessible'
        ELSE 'standard'
    END
FROM generate_series(1, 20) AS gs;

INSERT INTO parking_spaces (lot_id, space_number, is_occupied, space_type)
SELECT
    2,
    'B' || gs,
    CASE WHEN gs IN (3, 7, 11, 19, 22, 28, 31, 36, 42, 47) THEN TRUE ELSE FALSE END,
    CASE
        WHEN gs IN (8, 16, 24, 40) THEN 'ev'
        WHEN gs IN (5, 25, 45) THEN 'accessible'
        ELSE 'standard'
    END
FROM generate_series(1, 50) AS gs;

INSERT INTO parking_spaces (lot_id, space_number, is_occupied, space_type)
SELECT
    3,
    'C' || gs,
    CASE WHEN gs IN (2, 9, 14, 20, 27, 35, 41, 49, 56, 63, 71, 84, 93, 98) THEN TRUE ELSE FALSE END,
    CASE
        WHEN gs IN (10, 30, 50, 70, 90) THEN 'ev'
        WHEN gs IN (15, 45, 75, 95) THEN 'accessible'
        ELSE 'standard'
    END
FROM generate_series(1, 100) AS gs;

INSERT INTO pricing_rules (lot_id, base_rate, peak_rate, peak_start, peak_end) VALUES
    (1, 3.00, 6.00, 8, 18),
    (2, 2.00, 4.50, 9, 17),
    (3, 5.00, 8.00, 6, 22);