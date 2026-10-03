import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';

import { forecastApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import Banner from '../components/Banner';
import StatCard from '../components/StatCard';
import {
  formatNumber, formatDate, formatDateTime, describeDays,
} from '../utils/format';

const RISK_LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const RISK_COLORS = { CRITICAL: '#dc2626', HIGH: '#d97706', MEDIUM: '#2563eb', LOW: '#16a34a' };

export default function Forecast() {
  const { hasRole } = useAuth();
  const canGenerate = hasRole('Admin', 'Fleet Manager');

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [generating, setGenerating] = useState(false);
  const [riskFilter, setRiskFilter] = useState('');
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await forecastApi.list({ risk_level: riskFilter || undefined });
      setRows(res.data);
      setMeta(res.meta || {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [riskFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setGenerating(true);
    setError('');
    setNotice('');
    try {
      const res = await forecastApi.generate();
      setNotice(
        `${res.message} — ${res.summary.CRITICAL} critical, ${res.summary.HIGH} high, ` +
        `${res.summary.MEDIUM} medium, ${res.summary.LOW} low.`
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const counts = RISK_LEVELS.reduce((acc, level) => {
    const found = (meta.risk_counts || []).find((r) => r.risk_level === level);
    acc[level] = found ? found.count : 0;
    return acc;
  }, {});

  const chartData = rows
    .slice()
    .sort((a, b) => a.days_until_service - b.days_until_service)
    .slice(0, 12)
    .map((f) => ({
      name: f.vehicle_number,
      days: f.days_until_service,
      risk: f.risk_level,
    }));

  const columns = [
    {
      key: 'vehicle',
      label: 'Vehicle',
      render: (f) => (
        <>
          <Link to={`/vehicles/${f.vehicle_id}`} className="strong">{f.vehicle_number}</Link>
          <div className="muted small">{f.manufacturer} {f.model}</div>
        </>
      ),
    },
    { key: 'maintenance_type', label: 'Service type' },
    {
      key: 'predicted_service_date',
      label: 'Predicted date',
      render: (f) => (
        <>
          <div className="nowrap">{formatDate(f.predicted_service_date)}</div>
          <div
            className="small"
            style={{ color: f.days_until_service < 0 ? 'var(--red-600)' : 'var(--text-muted)' }}
          >
            {describeDays(f.days_until_service)}
          </div>
        </>
      ),
    },
    {
      key: 'predicted_odometer',
      label: 'Predicted odometer',
      align: 'right',
      render: (f) => (
        <>
          <div>{formatNumber(f.predicted_odometer)} km</div>
          <div className="muted small">now {formatNumber(f.current_odometer)} km</div>
        </>
      ),
    },
    {
      key: 'avg_daily_km',
      label: 'Avg usage',
      align: 'right',
      render: (f) => `${formatNumber(f.avg_daily_km, 1)} km/day`,
    },
    {
      key: 'risk_level',
      label: 'Risk',
      render: (f) => <span className={`risk-pill risk-${f.risk_level}`}>{f.risk_level}</span>,
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (f) => (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDetail(f)}>
          Why?
        </button>
      ),
    },
  ];

  const toolbar = (
    <>
      <select
        className="form-control" style={{ width: 'auto' }}
        value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}
      >
        <option value="">All risk levels</option>
        {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      {riskFilter && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRiskFilter('')}>
          Clear
        </button>
      )}
      <span className="muted small" style={{ marginLeft: 'auto' }}>
        {meta.generated_at
          ? `Last generated ${formatDateTime(meta.generated_at)}`
          : 'Not generated yet'}
      </span>
    </>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Maintenance forecast</h1>
          <p className="page-subtitle">
            Predicted service dates calculated from trip distance, service history and repair frequency
          </p>
        </div>
        {canGenerate && (
          <div className="page-header-actions">
            <button type="button" className="btn btn-primary" onClick={generate} disabled={generating}>
              {generating ? <><span className="spinner sm" /> Generating…</> : '⚡ Regenerate forecast'}
            </button>
          </div>
        )}
      </div>

      <Banner type="error" message={error} onClose={() => setError('')} />
      <Banner type="success" message={notice} onClose={() => setNotice('')} />

      <div className="grid grid-stats mb-3">
        <StatCard label="Critical" value={counts.CRITICAL} hint="Service overdue" icon="⚠" tone="red" />
        <StatCard label="High" value={counts.HIGH} hint="Due within 15 days" icon="↑" tone="amber" />
        <StatCard label="Medium" value={counts.MEDIUM} hint="Due within 30 days" icon="→" tone="blue" />
        <StatCard label="Low" value={counts.LOW} hint="No action needed yet" icon="✓" tone="green" />
      </div>

      <div className="card mb-3">
        <div className="card-header">
          <div>
            <div className="card-title">Days until predicted service</div>
            <div className="card-subtitle">The twelve most urgent vehicles</div>
          </div>
        </div>
        <div className="card-body">
          <div className="chart-box tall">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis
                  dataKey="name" stroke="#94a3b8" fontSize={11}
                  angle={-35} textAnchor="end" height={70} tickLine={false}
                />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  formatter={(v, n, p) => [describeDays(v), p.payload.risk]}
                />
                <Bar dataKey="days" name="Days" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={RISK_COLORS[entry.risk]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns} rows={rows} loading={loading}
        rowKey={(r) => r.forecast_id}
        toolbar={toolbar}
        emptyIcon="📈"
        emptyMessage="No forecasts yet — generate one to get started"
      />

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={`Forecast — ${detail?.vehicle_number || ''}`}
        footer={
          <button type="button" className="btn btn-secondary" onClick={() => setDetail(null)}>Close</button>
        }
      >
        {detail && (
          <>
            <div className="flex-row mb-3">
              <span className={`risk-pill risk-${detail.risk_level}`}>{detail.risk_level} RISK</span>
              <span className="muted small">Generated {formatDateTime(detail.generated_date)}</span>
            </div>

            <div className="detail-grid mb-3">
              <div className="detail-item">
                <div className="detail-label">Predicted service date</div>
                <div className="detail-value">{formatDate(detail.predicted_service_date)}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Days until service</div>
                <div className="detail-value">{describeDays(detail.days_until_service)}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Predicted odometer</div>
                <div className="detail-value">{formatNumber(detail.predicted_odometer)} km</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Current odometer</div>
                <div className="detail-value">{formatNumber(detail.current_odometer)} km</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Average daily distance</div>
                <div className="detail-value">{formatNumber(detail.avg_daily_km, 1)} km/day</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Service type</div>
                <div className="detail-value">{detail.maintenance_type}</div>
              </div>
            </div>

            <div className="detail-label">How this was calculated</div>
            <p className="reason-text mt-3">{detail.reason}</p>

            <div className="mt-3">
              <Link to={`/vehicles/${detail.vehicle_id}`} className="btn btn-primary btn-sm">
                Open vehicle record →
              </Link>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
