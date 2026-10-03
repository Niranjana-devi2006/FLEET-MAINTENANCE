const AlertModel = require('../models/alertModel');
const alertService = require('../services/alertService');
const { ApiError, asyncHandler } = require('../middleware/errorMiddleware');

/** GET /api/alerts */
const getAlerts = asyncHandler(async (req, res) => {
  const { status, priority, vehicle_id: vehicleId, type, limit } = req.query;

  const [rows, unread, priorityCounts] = await Promise.all([
    AlertModel.findAll({ status, priority, vehicle_id: vehicleId, type, limit }),
    AlertModel.countUnread(),
    AlertModel.countByPriority(),
  ]);

  res.status(200).json({
    success: true,
    data: rows,
    meta: { unread, priority_counts: priorityCounts, total: rows.length },
  });
});

/** GET /api/alerts/:id */
const getAlertById = asyncHandler(async (req, res) => {
  const alert = await AlertModel.findById(req.params.id);
  if (!alert) throw new ApiError(404, 'Alert not found');
  res.status(200).json({ success: true, data: alert });
});

/** PUT /api/alerts/:id/read */
const markAlertRead = asyncHandler(async (req, res) => {
  const alert = await AlertModel.findById(req.params.id);
  if (!alert) throw new ApiError(404, 'Alert not found');

  await AlertModel.markRead(req.params.id);
  const updated = await AlertModel.findById(req.params.id);
  res.status(200).json({ success: true, data: updated });
});

/** PUT /api/alerts/:id/resolve */
const resolveAlert = asyncHandler(async (req, res) => {
  const alert = await AlertModel.findById(req.params.id);
  if (!alert) throw new ApiError(404, 'Alert not found');

  await AlertModel.updateStatus(req.params.id, 'Resolved');
  const updated = await AlertModel.findById(req.params.id);
  res.status(200).json({ success: true, data: updated });
});

/** PUT /api/alerts/read-all */
const markAllRead = asyncHandler(async (req, res) => {
  const count = await AlertModel.markAllRead();
  res.status(200).json({
    success: true,
    data: { message: `${count} alert${count === 1 ? '' : 's'} marked as read`, count },
  });
});

/** DELETE /api/alerts/:id */
const deleteAlert = asyncHandler(async (req, res) => {
  const alert = await AlertModel.findById(req.params.id);
  if (!alert) throw new ApiError(404, 'Alert not found');

  await AlertModel.remove(req.params.id);
  res.status(200).json({ success: true, data: { message: 'Alert deleted successfully' } });
});

/**
 * POST /api/alerts/generate
 * Re-evaluates every alert condition against the live database.
 */
const generateAlerts = asyncHandler(async (req, res) => {
  const alerts = await alertService.generateAlerts();

  const summary = alerts.reduce((acc, a) => {
    acc[a.priority] = (acc[a.priority] || 0) + 1;
    return acc;
  }, { Low: 0, Medium: 0, High: 0, Critical: 0 });

  res.status(201).json({
    success: true,
    data: {
      message: `Generated ${alerts.length} alert${alerts.length === 1 ? '' : 's'}`,
      count: alerts.length,
      summary,
    },
  });
});

module.exports = {
  getAlerts,
  getAlertById,
  markAlertRead,
  resolveAlert,
  markAllRead,
  deleteAlert,
  generateAlerts,
};
