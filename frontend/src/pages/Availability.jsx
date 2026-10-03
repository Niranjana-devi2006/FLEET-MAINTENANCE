import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import { vehicleApi } from '../services/api';
import Loader from '../components/Loader';
import Banner from '../components/Banner';
import StatCard from '../components/StatCard';
import { formatNumber, statusBadge } from '../utils/format';

const STATUS_ORDER = ['Available', 'On Trip', 'Under Maintenance', 'Out of Service'];

const STATUS_META = {
  Available: { icon: '✓', tone: 'green', hint: 'Ready to assign' },
  'On Trip': { icon: '🗺', tone: 'purple', hint: 'Currently on the road' },
  'Under Maintenance': { icon: '🔧', tone: 'amber', hint: 'In the workshop' },
  'Out of Service': { icon: '⚠', tone: 'red', hint: 'Grounded' },
};

export default function Availability() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    vehicleApi
      .availability()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <Loader text="Loading availability…" />;
  if (error) return <Banner type="error" message={error} />;

  const countFor = (status) => {
    const row = (data.status_counts || []).find((r) => r.status === status);
    return row ? row.count : 0;
  };

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    vehicles: data.vehicles.filter((v) => v.status === status),
  }));

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Vehicle availability</h1>
          <p className="page-subtitle">
            {data.available} of {data.total} vehicles available — {data.availability_rate}% of the fleet
          </p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-secondary" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      <div className="grid grid-stats mb-3">
        {STATUS_ORDER.map((status) => (
          <StatCard
            key={status}
            label={status}
            value={formatNumber(countFor(status))}
            hint={STATUS_META[status].hint}
            icon={STATUS_META[status].icon}
            tone={STATUS_META[status].tone}
          />
        ))}
      </div>

      <div className="card mb-3">
        <div className="card-header">
          <div className="card-title">Fleet availability</div>
          <div className="card-header-actions">
            <span className="strong">{data.availability_rate}%</span>
          </div>
        </div>
        <div className="card-body">
          <div className="progress-track" style={{ height: 12 }}>
            <div
              className="progress-fill"
              style={{
                width: `${data.availability_rate}%`,
                background: data.availability_rate >= 60
                  ? 'var(--green-600)'
                  : data.availability_rate >= 35
                    ? 'var(--amber-600)'
                    : 'var(--red-600)',
              }}
            />
          </div>
          <p className="muted small mt-3">
            Share of the fleet currently marked Available. Vehicles on trips, in the
            workshop, or grounded are excluded.
          </p>
        </div>
      </div>

      <div className="grid grid-2">
        {grouped.map(({ status, vehicles }) => (
          <div className="card" key={status}>
            <div className="card-header">
              <div className="card-title">
                <span className={`badge ${statusBadge(status)}`}>{status}</span>
              </div>
              <div className="card-header-actions">
                <span className="muted small">{vehicles.length} vehicles</span>
              </div>
            </div>

            {vehicles.length === 0 ? (
              <div className="table-empty">No vehicles in this state</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Vehicle</th><th>Type</th><th className="num">Odometer</th>
                      {status === 'Under Maintenance' && <th>Active repair</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map((v) => (
                      <tr key={v.vehicle_id}>
                        <td>
                          <Link to={`/vehicles/${v.vehicle_id}`} className="strong">
                            {v.vehicle_number}
                          </Link>
                          <div className="muted small">{v.manufacturer} {v.model}</div>
                        </td>
                        <td>{v.vehicle_type}</td>
                        <td className="num">{formatNumber(v.current_odometer)} km</td>
                        {status === 'Under Maintenance' && (
                          <td className="small">
                            {v.active_repair ? (
                              <>
                                <div>{v.active_repair.problem_description}</div>
                                <div className="muted">
                                  {formatNumber(v.active_repair.downtime_hours, 1)} h downtime
                                </div>
                              </>
                            ) : (
                              <span className="muted">Scheduled servicing</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
