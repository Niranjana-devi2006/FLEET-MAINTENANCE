import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';

import { vehicleApi } from '../services/api';
import Loader from '../components/Loader';
import Banner from '../components/Banner';
import AlertCard from '../components/AlertCard';
import StatCard from '../components/StatCard';
import {
  formatCurrency, formatNumber, formatDate, statusBadge, describeDays,
} from '../utils/format';

const TABS = [
  ['overview', 'Overview'],
  ['trips', 'Trip history'],
  ['maintenance', 'Service history'],
  ['repairs', 'Repair history'],
  ['forecast', 'Forecast'],
  ['alerts', 'Alerts'],
];

export default function VehicleDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    setLoading(true);
    vehicleApi
      .get(id)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Loader text="Loading vehicle…" />;

  if (error) {
    return (
      <>
        <Banner type="error" message={error} />
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/vehicles')}>
          ← Back to vehicles
        </button>
      </>
    );
  }

  const { vehicle, trips, maintenance, repairs, forecast, alerts, summary } = data;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="flex-row">
            <h1 className="page-title">{vehicle.vehicle_number}</h1>
            <span className={`badge ${statusBadge(vehicle.status)}`}>{vehicle.status}</span>
          </div>
          <p className="page-subtitle">
            {vehicle.manufacturer} {vehicle.model} · {vehicle.vehicle_type} · {vehicle.fuel_type}
          </p>
        </div>
        <div className="page-header-actions">
          <Link to="/vehicles" className="btn btn-secondary">← All vehicles</Link>
        </div>
      </div>

      <div className="grid grid-stats mb-3">
        <StatCard
          label="Odometer" value={`${formatNumber(vehicle.current_odometer)} km`}
          hint="Current reading" icon="⏱" tone="blue"
        />
        <StatCard
          label="Distance driven" value={`${formatNumber(summary.total_distance)} km`}
          hint={`${summary.total_trips} trips on record`} icon="🗺" tone="purple"
        />
        <StatCard
          label="Maintenance cost" value={formatCurrency(summary.total_maintenance_cost)}
          hint={`${maintenance.length} service records`} icon="🔧" tone="green"
        />
        <StatCard
          label="Repair cost" value={formatCurrency(summary.total_repair_cost)}
          hint={`${formatNumber(summary.total_downtime_hours, 1)} h downtime`} icon="🛠" tone="amber"
        />
      </div>

      <div className="card">
        <div className="tabs">
          {TABS.map(([key, label]) => (
            <button
              key={key} type="button"
              className={`tab ${tab === key ? 'active' : ''}`}
              onClick={() => setTab(key)}
            >
              {label}
              {key === 'alerts' && alerts.length > 0 && ` (${alerts.length})`}
            </button>
          ))}
        </div>

        {/* ---------------- overview ---------------- */}
        {tab === 'overview' && (
          <div className="card-body">
            <div className="detail-grid">
              <Detail label="Vehicle number" value={vehicle.vehicle_number} />
              <Detail label="Type" value={vehicle.vehicle_type} />
              <Detail label="Manufacturer" value={vehicle.manufacturer} />
              <Detail label="Model" value={vehicle.model} />
              <Detail label="Fuel type" value={vehicle.fuel_type} />
              <Detail
                label="Status"
                value={<span className={`badge ${statusBadge(vehicle.status)}`}>{vehicle.status}</span>}
              />
              <Detail label="Current mileage" value={`${formatNumber(vehicle.current_odometer)} km`} />
              <Detail label="Purchase date" value={formatDate(vehicle.purchase_date)} />
              <Detail label="Registration date" value={formatDate(vehicle.registration_date)} />
              <Detail label="Last service" value={formatDate(vehicle.last_service_date)} />
              <Detail label="Next service" value={formatDate(vehicle.next_service_date)} />
              <Detail label="Added on" value={formatDate(vehicle.created_at)} />
            </div>
          </div>
        )}

        {/* ---------------- trips ---------------- */}
        {tab === 'trips' && (
          <SimpleTable
            empty="No trips recorded for this vehicle"
            head={['Route', 'Driver', 'Dates', 'Distance', 'Fuel', 'Status']}
            rows={trips.map((t) => [
              <span key="r" className="strong">{t.start_location} → {t.destination}</span>,
              t.driver_name,
              <span key="d" className="nowrap small">
                {formatDate(t.start_date)}
                {t.end_date ? ` → ${formatDate(t.end_date)}` : ''}
              </span>,
              `${formatNumber(t.distance_km)} km`,
              `${formatNumber(t.fuel_consumed, 1)} L`,
              <span key="s" className={`badge ${statusBadge(t.trip_status)}`}>{t.trip_status}</span>,
            ])}
          />
        )}

        {/* ---------------- maintenance ---------------- */}
        {tab === 'maintenance' && (
          <SimpleTable
            empty="No service history for this vehicle"
            head={['Type', 'Date', 'Odometer', 'Cost', 'Technician', 'Next service', 'Status']}
            rows={maintenance.map((m) => [
              <span key="t" className="strong">{m.maintenance_type}</span>,
              formatDate(m.service_date),
              `${formatNumber(m.odometer_reading)} km`,
              formatCurrency(m.service_cost),
              m.technician || '—',
              <span key="n" className="small nowrap">
                {formatDate(m.next_service_date)}
                {m.next_service_odometer
                  ? <div className="muted">{formatNumber(m.next_service_odometer)} km</div>
                  : null}
              </span>,
              <span key="s" className={`badge ${statusBadge(m.status)}`}>{m.status}</span>,
            ])}
          />
        )}

        {/* ---------------- repairs ---------------- */}
        {tab === 'repairs' && (
          <SimpleTable
            empty="No repairs recorded for this vehicle"
            head={['Date', 'Problem', 'Parts replaced', 'Cost', 'Downtime', 'Technician', 'Status']}
            rows={repairs.map((r) => [
              formatDate(r.repair_date),
              <div key="p" style={{ maxWidth: 240 }}>
                <div className="strong small">{r.problem_description}</div>
                {r.repair_description && <div className="muted small">{r.repair_description}</div>}
              </div>,
              <span key="pr" className="small">{r.parts_replaced || '—'}</span>,
              formatCurrency(r.repair_cost),
              `${formatNumber(r.downtime_hours, 1)} h`,
              r.technician || '—',
              <span key="s" className={`badge ${statusBadge(r.status)}`}>{r.status}</span>,
            ])}
          />
        )}

        {/* ---------------- forecast ---------------- */}
        {tab === 'forecast' && (
          <div className="card-body">
            {!forecast ? (
              <div className="table-empty">
                <span className="table-empty-icon" aria-hidden="true">📈</span>
                No forecast stored yet — generate one from the Forecast page.
                <div className="mt-3">
                  <Link to="/forecast" className="btn btn-primary btn-sm">Go to Forecast</Link>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-row mb-3">
                  <span className={`risk-pill risk-${forecast.risk_level}`}>{forecast.risk_level} RISK</span>
                  <span className="muted small">
                    Generated {formatDate(forecast.generated_date)}
                  </span>
                </div>

                <div className="detail-grid mb-3">
                  <Detail label="Maintenance type" value={forecast.maintenance_type} />
                  <Detail
                    label="Predicted service date"
                    value={formatDate(forecast.predicted_service_date)}
                  />
                  <Detail
                    label="Predicted odometer"
                    value={`${formatNumber(forecast.predicted_odometer)} km`}
                  />
                  <Detail
                    label="Days until service"
                    value={describeDays(forecast.days_until_service)}
                  />
                  <Detail
                    label="Average daily distance"
                    value={`${formatNumber(forecast.avg_daily_km, 1)} km/day`}
                  />
                  <Detail
                    label="Current odometer"
                    value={`${formatNumber(vehicle.current_odometer)} km`}
                  />
                </div>

                <div className="detail-label">How this was calculated</div>
                <p className="reason-text mt-3">{forecast.reason}</p>
              </>
            )}
          </div>
        )}

        {/* ---------------- alerts ---------------- */}
        {tab === 'alerts' && (
          <div className="card-body tight">
            {alerts.length === 0 ? (
              <div className="table-empty">
                <span className="table-empty-icon" aria-hidden="true">✓</span>
                No alerts for this vehicle
              </div>
            ) : (
              alerts.map((a) => <AlertCard key={a.alert_id} alert={a} compact />)
            )}
          </div>
        )}
      </div>
    </>
  );
}

function Detail({ label, value }) {
  return (
    <div className="detail-item">
      <div className="detail-label">{label}</div>
      <div className="detail-value">{value || '—'}</div>
    </div>
  );
}

function SimpleTable({ head, rows, empty }) {
  if (rows.length === 0) {
    return (
      <div className="table-empty">
        <span className="table-empty-icon" aria-hidden="true">📋</span>
        {empty}
      </div>
    );
  }
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>{head.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <tr key={i}>
              {cells.map((cell, j) => <td key={j}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
