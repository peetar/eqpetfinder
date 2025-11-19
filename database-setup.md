# Database Setup Instructions

## Prerequisites
- MySQL server installed and running

## Setup Steps

1. **Create the database:**
   ```sql
   CREATE DATABASE quarm;
   USE quarm;
   ```

2. **Import the SQL dumps** (in this order):
   ```sql
   SOURCE c:/code/eqpetfinder/dump/quarm_2025-11-02-07_55/quarm_2025-11-02-07_55.sql;
   SOURCE c:/code/eqpetfinder/dump/quarm_2025-11-02-07_55/player_tables_2025-11-02-07_55.sql;
   SOURCE c:/code/eqpetfinder/dump/quarm_2025-11-02-07_55/login_tables_2025-11-02-07_55.sql;
   ```

3. **Create a database user** (optional but recommended):
   ```sql
   CREATE USER 'eqpet'@'localhost' IDENTIFIED BY 'your_password_here';
   GRANT SELECT ON quarm.* TO 'eqpet'@'localhost';
   FLUSH PRIVILEGES;
   ```

4. **Configure the application:**
   - Copy `.env.example` to `.env`
   - Update the database credentials in `.env`

## Notes
- The main SQL file is quite large (~250MB+)
- Import may take several minutes
- Ensure you have sufficient disk space
