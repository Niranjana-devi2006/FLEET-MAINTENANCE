# 🗄️ MySQL Installation & Database Setup Guide for Windows

## Step 1 — Download MySQL

Go to: **https://dev.mysql.com/downloads/installer/**

Click **"Download"** on the **MySQL Installer for Windows** (the full ~450MB one, not the web version).

You don't need to create an Oracle account — scroll down and click **"No thanks, just start my download"**.

---

## Step 2 — Install MySQL Server + Workbench

1. Run the downloaded installer (`mysql-installer-community-x.x.x.msi`)
2. If asked about setup type, choose **"Developer Default"**
3. Click **"Execute"** to install all components — this installs:
   - **MySQL Server 8.0** (the database engine)
   - **MySQL Workbench** (the GUI tool)
   - MySQL Shell, Connector/J, etc.
4. Click **"Next"** through product configuration
5. **Root Password:** When asked, set the root password to: `root`
   - (This must match the `DB_PASSWORD=root` in `backend/.env`)
   - ⚠️ If you set a different password, update `backend/.env` accordingly
6. Leave everything else as default and finish the installation

---

## Step 3 — Verify MySQL is Running

Open **PowerShell** and type:

```powershell
mysql -u root -p
```

Type your password when prompted. If you see:
```
mysql>
```
MySQL is working. Type `exit` to quit.

If you get **"mysql is not recognized"**, MySQL's bin folder isn't in PATH. Either:
- Restart your computer (it usually fixes PATH automatically), or
- Add `C:\Program Files\MySQL\MySQL Server 8.0\bin` to your System PATH manually

---

## Step 4 — Import the Database

### Using MySQL Workbench (GUI method):

1. Open **MySQL Workbench** from Start Menu
2. Click on **Local instance MySQL80** (the connection shown on the home screen)
3. Enter your root password → click **OK**
4. Go to menu: **File → Open SQL Script**
5. Navigate to your project folder:
   ```
   C:\Users\Kamesh\OneDrive\Desktop\DB\database.sql
   ```
6. Click **Open**
7. Click the **⚡ Execute All** button (or press **Ctrl + Shift + Enter**)
8. Wait for the output panel at the bottom to show:
   ```
   'fleet_maintenance database created successfully'
   ```

### Using Command Line (alternative):

```powershell
mysql -u root -p < "C:\Users\Kamesh\OneDrive\Desktop\DB\database.sql"
```

---

## Step 5 — Verify the Database

In MySQL Workbench, run this in a query tab:

```sql
USE fleet_maintenance;
SHOW TABLES;
SELECT COUNT(*) FROM vehicles;
SELECT COUNT(*) FROM users;
```

You should see 9 tables and 12 vehicles, 5 users.

---

## Done! Now run the project:

**Terminal 1 — Backend:**
```powershell
cd "C:\Users\Kamesh\OneDrive\Desktop\DB\backend"
npm install
npm run dev
```

**Terminal 2 — Frontend:**
```powershell
cd "C:\Users\Kamesh\OneDrive\Desktop\DB\frontend"
npm install
npm run dev
```

Open browser: **http://localhost:5173**

Login with: `admin@fleet.com` / `Admin@123`
