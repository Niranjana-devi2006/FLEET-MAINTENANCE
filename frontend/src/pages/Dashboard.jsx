import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

import { dashboardApi, forecastApi, alertApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import AlertCard from '../components/AlertCard';
import Loader from '../components/Loader';
import Banner from '../components/Banner';
import {
  formatCurrency, formatNumber, formatDate, formatMonth,
  describeDays, statusBadge,
} from '../utils/format';

const STATUS_COLORS = {
  Available: '#16a34a',
  'On Trip': '#2563eb',
  'Under Maintenance': '#d97706',
  'Out of Service': '#dc2626',
};

const CHART_COLORS = ['#2563eb', '#7c3aed', '#16a34a', '#d97706', '#dc2626', '#0891b2', '#db2777', '#65a30d'];

const axisProps = { stroke: '#94a3b8', fontSize: 11, tickLine: false };

export default function Dashboard() {
  const { hasRole } = useAuth();
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [tables, setTables] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [s, c, t] = await Promise.all([
        dashboardApi.stats(),
        dashboardApi.charts(12),
        dashboardApi.tables(),
      ]);
      setStats(s);
      setCharts(c);
      setTables(t);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /** Re-run both engines, then refresh the whole page data. */
  const refreshEngines = async () => {
    setWorking(true);
    setNotice('');
    setError('');
    try {
      const [f, a] = await Promise.all([forecastApi.generate(), alertApi.generate()]);
      setNotice(`${f.message}. ${a.message}.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <Loader text="Loading fleet data…" />;

  if (error && !stats) {
    return (
      <>
        <Banner type="error" message={error} />
        <button type="button" className="btn btn-primary" onClick={load}>Retry</button>
      </>
    );
  }

  const statusData = (charts?.vehicle_status_distribution || []).map((r) => ({
    name: r.status,
    value: r.count,
  }));

  const maintenanceCostData = (charts?.maintenance_cost_by_month || []).map((r) => ({
    month: formatMonth(r.month),
    cost: Number(r.total_cost),
    services: r.service_count,
  }));

  const repairCostData = (charts?.repair_cost_by_month || []).map((r) => ({
    month: formatMonth(r.month),
    cost: Number(r.total_cost),
    downtime: Number(r.total_downtime),
  }));

  const utilisationData = (charts?.vehicle_utilisation || [])
    .slice(0, 8)
    .map((r) => ({ name: r.vehicle_number, distance: Number(r.total_distance), trips: r.trip_count }));

  const frequencyData = (charts?.maintenance_frequency || []).map((r) => ({
    name: r.maintenance_type,
    count: r.count,
  }));

  const upcomingData = (charts?.upcoming_maintenance || [])
    .slice(0, 10)
    .map((r) => ({ name: r.vehicle_number, days: r.days_remaining }));

  const downtimeData = (charts?.repair_downtime || [])
    .slice(0, 8)
    .map((r) => ({ name: r.vehicle_number, hours: Number(r.total_downtime) }));

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Fleet overview</h1>
          <p className="page-subtitle">
            Live figures from {formatNumber(stats.total_vehicles)} vehicles and{' '}
            {formatNumber(stats.total_drivers)} drivers.
          </p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-secondary" onClick={load} disabled={working}>
            ↻ Refresh
          </button>
          {hasRole('Admin', 'Fleet Manager') && (
            <button
              type="button" className="btn btn-primary"
              onClick={refreshEngines} disabled={working}
            >
              {working ? <><span className="spinner sm" /> Running…</> : '⚡ Regenerate forecast & alerts'}
            </button>
          )}
        </div>
      </div>

      <Banner type="error" message={error} onClose={() => setError('')} />
      <Banner type="success" message={notice} onClose={() => setNotice('')} />

      {/* ---------------- summary cards ---------------- */}
      <div className="grid grid-stats mb-3">
        <StatCard
          label="Total vehicles" value={formatNumber(stats.total_vehicles)}
          hint={`${formatNumber(stats.total_drivers)} drivers on record`} icon="🚚" tone="blue"
        />
        <StatCard
          label="Available" value={formatNumber(stats.available_vehicles)}
          hint={`${stats.fleet_utilisation}% utilised (${stats.utilisation_window_days}d)`}
          icon="✓" tone="green"
        />
        <StatCard
          label="On trip" value={formatNumber(stats.vehicles_on_trip)}
          hint="Currently assigned" icon="🗺" tone="purple"
        />
        <StatCard
          label="Under maintenance" value={formatNumber(stats.vehicles_under_maintenance)}
          hint={`${formatNumber(stats.open_repairs)} open repairs`} icon="🔧" tone="amber"
        />
        <StatCard
          label="Upcoming maintenance" value={formatNumber(stats.upcoming_services)}
          hint={`${formatNumber(stats.vehicles_requiring_service)} vehicles need service`}
          icon="📅" tone="slate"
        />
        <StatCard
          label="Critical alerts" value={formatNumber(stats.critical_alerts)}
          hint={`${formatNumber(stats.unread_alerts)} unread`} icon="⚠" tone="red"
        />
      </div>

      <div className="grid grid-stats mb-3">
        <StatCard
          label="Maintenance cost" value={formatCurrency(stats.total_maintenance_cost)}
          hint="All completed servicing" icon="₹" tone="blue"
        />
        <StatCard
          label="Repair cost" value={formatCurrency(stats.total_repair_cost)}
          hint="All logged repairs" icon="₹" tone="amber"
        />
        <StatCard
          label="Total spend" value={formatCurrency(stats.total_cost)}
          hint="Maintenance + repairs" icon="Σ" tone="purple"
        />
        <StatCard
          label="High-risk forecasts" value={formatNumber(stats.high_risk_forecasts)}
          hint="HIGH or CRITICAL risk" icon="📈" tone="red"
        />
      </div>

      {/* ---------------- charts ---------------- */}
      <div className="grid grid-2 mb-3">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Maintenance cost by month</div>
              <div className="card-subtitle">Completed services, last 12 months</div>
            </div>
          </div>
          <div className="card-body">
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={maintenanceCostData}>
                  <defs>
                    <linearGradient id="gradMaint" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="month" {...axisProps} />
                  <YAxis {...axisProps} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip formatter={(v, n) => (n === 'cost' ? formatCurrency(v) : v)} />
                  <Area
                    type="monotone" dataKey="cost" name="Cost"
                    stroke="#2563eb" strokeWidth={2} fill="url(#gradMaint)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Repair cost by month</div>
              <div className="card-subtitle">Repair spend and downtime</div>
            </div>
          </div>
          <div className="card-body">
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={repairCostData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="month" {...axisProps} />
                  <YAxis {...axisProps} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip formatter={(v, n) => (n === 'Cost' ? formatCurrency(v) : `${v} h`)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone" dataKey="cost" name="Cost"
                    stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone" dataKey="downtime" name="Downtime (h)"
                    stroke="#d97706" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-3 mb-3">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Vehicle status</div>
          </div>
          <div className="card-body">
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={2}
                  >
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11.5 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Vehicle utilisation</div>
              <div className="card-subtitle">Distance, last 90 days</div>
            </div>
          </div>
          <div className="card-body">
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={utilisationData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
                  <XAxis type="number" {...axisProps} tickFormatter={(v) => `${v / 1000}k`} />
                  <YAxis type="category" dataKey="name" {...axisProps} width={78} />
                  <Tooltip formatter={(v) => `${formatNumber(v)} km`} />
                  <Bar dataKey="distance" name="Distance" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Maintenance frequency</div>
              <div className="card-subtitle">Services by type</div>
            </div>
          </div>
          <div className="card-body">
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={frequencyData} dataKey="count" nameKey="name"
                    cx="50%" cy="50%" outerRadius={80}
                  >
                    {frequencyData.map((entry, i) => (
                      <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10.5 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-2 mb-3">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Upcoming maintenance</div>
              <div className="card-subtitle">Days until the next scheduled service</div>
            </div>
          </div>
          <div className="card-body">
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={upcomingData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="name" {...axisProps} angle={-35} textAnchor="end" height={64} />
                  <YAxis {...axisProps} />
                  <Tooltip formatter={(v) => describeDays(v)} />
                  <Bar dataKey="days" name="Days" radius={[4, 4, 0, 0]}>
                    {upcomingData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={entry.days < 0 ? '#dc2626' : entry.days <= 15 ? '#d97706' : '#2563eb'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Repair downtime</div>
              <div className="card-subtitle">Total hours off the road</div>
            </div>
          </div>
          <div className="card-body">
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={downtimeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="name" {...axisProps} angle={-35} textAnchor="end" height={64} />
                  <YAxis {...axisProps} />
                  <Tooltip formatter={(v) => `${formatNumber(v, 1)} hours`} />
                  <Bar dataKey="hours" name="Downtime" fill="#d97706" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- tables ---------------- */}
      <div className="grid grid-2 mb-3">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Vehicles requiring maintenance</div>
            <div className="card-header-actions">
              <Link to="/forecast" className="small">View forecast →</Link>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vehicle</th><th>Odometer</th><th>Next service</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(tables?.vehicles_requiring_maintenance || []).slice(0, 8).map((v) => (
                  <tr key={v.vehicle_id}>
                    <td>
                      <Link to={`/vehicles/${v.vehicle_id}`} className="strong">{v.vehicle_number}</Link>
                      <div className="muted small">{v.manufacturer} {v.model}</div>
                    </td>
                    <td className="num">{formatNumber(v.current_odometer)} km</td>
                    <td className="nowrap">
                      {formatDate(v.next_service_date)}
                      <div
                        className="small"
                        style={{ color: v.days_remaining < 0 ? 'var(--red-600)' : 'var(--text-muted)' }}
                      >
                        {describeDays(v.days_remaining)}
                      </div>
                    </td>
                    <td><span className={`badge ${statusBadge(v.status)}`}>{v.status}</span></td>
                  </tr>
                ))}
                {(tables?.vehicles_requiring_maintenance || []).length === 0 && (
                  <tr><td colSpan={4} className="table-empty">Nothing due in the next 30 days</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Upcoming services</div>
            <div className="card-header-actions">
              <Link to="/maintenance" className="small">All maintenance →</Link>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Vehicle</th><th>Type</th><th>Date</th><th>Status</th></tr>
              </thead>
              <tbody>
                {(tables?.upcoming_services || []).map((m) => (
                  <tr key={m.maintenance_id}>
                    <td>
                      <Link to={`/vehicles/${m.vehicle_id}`} className="strong">{m.vehicle_number}</Link>
                    </td>
                    <td>{m.maintenance_type}</td>
                    <td className="nowrap">{formatDate(m.service_date)}</td>
                    <td><span className={`badge ${statusBadge(m.status)}`}>{m.status}</span></td>
                  </tr>
                ))}
                {(tables?.upcoming_services || []).length === 0 && (
                  <tr><td colSpan={4} className="table-empty">No scheduled services</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-2 mb-3">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent repairs</div>
            <div className="card-header-actions">
              <Link to="/repairs" className="small">All repairs →</Link>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Vehicle</th><th>Problem</th><th>Cost</th><th>Status</th></tr>
              </thead>
              <tbody>
                {(tables?.recent_repairs || []).map((r) => (
                  <tr key={r.repair_id}>
                    <td>
                      <Link to={`/vehicles/${r.vehicle_id}`} className="strong">{r.vehicle_number}</Link>
                      <div className="muted small">{formatDate(r.repair_date)}</div>
                    </td>
                    <td style={{ maxWidth: 220 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.problem_description}
                      </div>
                    </td>
                    <td className="num">{formatCurrency(r.repair_cost)}</td>
                    <td><span className={`badge ${statusBadge(r.status)}`}>{r.status}</span></td>
                  </tr>
                ))}
                {(tables?.recent_repairs || []).length === 0 && (
                  <tr><td colSpan={4} className="table-empty">No repairs logged</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent trips</div>
            <div className="card-header-actions">
              <Link to="/trips" className="small">All trips →</Link>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Vehicle</th><th>Route</th><th>Distance</th><th>Status</th></tr>
              </thead>
              <tbody>
                {(tables?.recent_trips || []).map((t) => (
                  <tr key={t.trip_id}>
                    <td>
                      <Link to={`/vehicles/${t.vehicle_id}`} className="strong">{t.vehicle_number}</Link>
                      <div className="muted small">{t.driver_name}</div>
                    </td>
                    <td className="small">{t.start_location} → {t.destination}</td>
                    <td className="num">{formatNumber(t.distance_km)} km</td>
                    <td><span className={`badge ${statusBadge(t.trip_status)}`}>{t.trip_status}</span></td>
                  </tr>
                ))}
                {(tables?.recent_trips || []).length === 0 && (
                  <tr><td colSpan={4} className="table-empty">No trips recorded</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Critical alerts</div>
          <div className="card-header-actions">
            <Link to="/alerts" className="small">All alerts →</Link>
          </div>
        </div>
        <div className="card-body tight">
          {(tables?.critical_alerts || []).length === 0 ? (
            <div className="table-empty">
              <span className="table-empty-icon" aria-hidden="true">✓</span>
              No critical alerts — the fleet is in good shape
            </div>
          ) : (
            (tables.critical_alerts || []).map((a) => (
              <AlertCard key={a.alert_id} alert={a} compact />
            ))
          )}
        </div>
      </div>
    </>
  );
}
