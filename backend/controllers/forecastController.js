const ForecastModel = require('../models/forecastModel');
const VehicleModel = require('../models/vehicleModel');
const forecastService = require('../services/forecastService');
const { ApiError, asyncHandler } = require('../middleware/errorMiddleware');

/**
 * GET /api/forecast
 * Latest stored forecast per vehicle. If none has ever been generated, one
 * run is kicked off so the page is never empty on first load.
 */
const getForecasts = asyncHandler(async (req, res) => {
  const { risk_level: riskLevel, vehicle_id: vehicleId } = req.query;

  let rows = await ForecastModel.findLatest({ risk_level: riskLevel, vehicle_id: vehicleId });

  if (rows.length === 0 && !riskLevel && !vehicleId) {
    await forecastService.generateForecasts();
    rows = await ForecastModel.findLatest({});
  }

  const [riskCounts, generatedAt] = await Promise.all([
    ForecastModel.countByRisk(),
    ForecastModel.lastGeneratedAt(),
  ]);

  res.status(200).json({
    success: true,
    data: rows,
    meta: {
      risk_counts: riskCounts,
      generated_at: generatedAt,
      total: rows.length,
    },
  });
});

/**
 * GET /api/forecast/:vehicleId
 * Returns the freshly-computed forecast plus this vehicle's forecast history.
 */
const getForecastByVehicle = asyncHandler(async (req, res) => {
  const { vehicleId } = req.params;

  const vehicle = await VehicleModel.findById(vehicleId);
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');

  const [current, history] = await Promise.all([
    forecastService.previewForecast(vehicleId),
    ForecastModel.findByVehicle(vehicleId, 10),
  ]);

  res.status(200).json({
    success: true,
    data: { vehicle, forecast: current, history },
  });
});

/**
 * POST /api/forecast/generate
 * Recomputes and stores forecasts for the whole fleet, or one vehicle when
 * `vehicle_id` is supplied in the body.
 */
const generateForecast = asyncHandler(async (req, res) => {
  const vehicleId = req.body.vehicle_id || null;

  if (vehicleId) {
    const vehicle = await VehicleModel.findById(vehicleId);
    if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  }

  const forecasts = await forecastService.generateForecasts(vehicleId);

  const summary = forecasts.reduce(
    (acc, f) => {
      acc[f.risk_level] = (acc[f.risk_level] || 0) + 1;
      return acc;
    },
    { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }
  );

  res.status(201).json({
    success: true,
    data: {
      message: `Generated ${forecasts.length} forecast${forecasts.length === 1 ? '' : 's'}`,
      count: forecasts.length,
      summary,
      forecasts,
    },
  });
});

module.exports = { getForecasts, getForecastByVehicle, generateForecast };
