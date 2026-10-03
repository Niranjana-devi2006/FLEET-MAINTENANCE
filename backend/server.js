require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { testConnection } = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const authRoutes = require('./routes/authRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const driverRoutes = require('./routes/driverRoutes');
const tripRoutes = require('./routes/tripRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const repairRoutes = require('./routes/repairRoutes');
const forecastRoutes = require('./routes/forecastRoutes');
const alertRoutes = require('./routes/alertRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const userRoutes = require('./routes/userRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// --- security & parsing -----------------------------------------------------
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// --- health check -----------------------------------------------------------
app.get('/api/health', async (req, res) => {
  try {
    await testConnection();
    res.status(200).json({
      success: true,
      data: { status: 'ok', database: 'connected', timestamp: new Date().toISOString() },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database unreachable' });
  }
});

// --- API routes -------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/repairs', repairRoutes);
app.use('/api/forecast', forecastRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);

// --- error handling ---------------------------------------------------------
app.use(notFound);
app.use(errorHandler);

// --- boot -------------------------------------------------------------------
async function start() {
  if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET is not set. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }

  try {
    await testConnection();
    console.log(`MySQL connected -> ${process.env.DB_NAME}@${process.env.DB_HOST}`);
  } catch (err) {
    console.error('FATAL: could not connect to MySQL.');
    console.error(`  ${err.code || ''} ${err.message}`);
    console.error('  Check DB_HOST / DB_USER / DB_PASSWORD / DB_NAME in backend/.env');
    console.error('  and that database.sql has been imported.');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Fleet Maintenance API listening on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });
}

// Only start a listener when run directly, so the app can be imported in tests.
if (require.main === module) {
  start();
}

module.exports = app;
