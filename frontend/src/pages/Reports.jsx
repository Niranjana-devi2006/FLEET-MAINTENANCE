import { useState, useEffect, useCallback } from 'react';

import { reportApi, vehicleApi, maintenanceApi } from '../services/api';
import DataTable from '../components/DataTable';
import Banner from '../components/Banner';
import { formatCurrency, formatNumber, formatDate, statusBadge } from '../utils/format';

/**
 * Each report declares its columns and which filters apply to it, so the page
 * is one generic runner rather than nine separate screens.
 */
const REPORTS = [
  {
    key: 'maintenance-history',
    label: 'Vehicle maintenance history',
    filters: ['vehicle', 'dates', 'type', 'maintenanceStatus'],
    columns: [
      { key: 'vehicle_number', label: 'Vehicle' },
      { key: 'maintenance_type', label: 'Type' },
      { key: 'service_date', label: 'Date', render: (r) => formatDate(r.service_date) },
      { key: 'odometer_reading', label: 'Odometer', align: 'right', render: (r) => `${formatNumber(r.odometer_reading)} km` },
      { key: 'service_cost', label: 'Cost', align: 'right', render: (r) => formatCurrency(r.service_cost) },
      { key: 'technician', label: 'Technician', render: (r) => r.technician || '—' },
      { key: 'status', label: 'Status', render: (r) => <span className={`badge ${statusBadge(r.status)}`}>{r.status}</span> },
    ],
  },
  {
    key: 'repair-history',
    label: 'Repair history',
    filters: ['vehicle', 'dates', 'repairStatus'],
    columns: [
      { key: 'vehicle_number', label: 'Vehicle' },
      { key: 'repair_date', label: 'Date', render: (r) => formatDate(r.repair_date) },
      { key: 'problem_description', label: 'Problem' },
      { key: 'parts_replaced', label: 'Parts', render: (r) => r.parts_replaced || '—' },
      { key: 'repair_cost', label: 'Cost', align: 'right', render: (r) => formatCurrency(r.repair_cost) },
      { key: 'downtime_hours', label: 'Downtime', align: 'right', render: (r) => `${formatNumber(r.downtime_hours, 1)} h` },
      { key: 'status', label: 'Status', render: (r) => <span className={`badge ${statusBadge(r.status)}`}>{r.status}</span> },
    ],
  },
  {
    key: 'maintenance-costs',
    label: 'Maintenance costs by vehicle',
    filters: ['dates'],
    columns: [
      { key: 'vehicle_number', label: 'Vehicle' },
      { key: 'vehicle_type', label: 'Type' },
      { key: 'service_count', label: 'Services', align: 'right' },
      { key: 'total_cost', label: 'Total cost', align: 'right', render: (r) => formatCurrency(r.total_cost) },
      { key: 'average_cost', label: 'Average', align: 'right', render: (r) => formatCurrency(r.average_cost) },
      { key: 'last_service', label: 'Last service', render: (r) => formatDate(r.last_service) },
    ],
  },
  {
    key: 'repair-costs',
    label: 'Repair costs by vehicle',
    filters: ['dates'],
    columns: [
      { key: 'vehicle_number', label: 'Vehicle' },
      { key: 'vehicle_type', label: 'Type' },
      { key: 'repair_count', label: 'Repairs', align: 'right' },
      { key: 'total_cost', label: 'Total cost', align: 'right', render: (r) => formatCurrency(r.total_cost) },
      { key: 'average_cost', label: 'Average', align: 'right', render: (r) => formatCurrency(r.average_cost) },
      { key: 'total_downtime', label: 'Downtime', align: 'right', render: (r) => `${formatNumber(r.total_downtime, 1)} h` },
    ],
  },
  {
    key: 'vehicle-utilisation',
    label: 'Vehicle utilisation',
    filters: [],
    columns: [
      { key: 'vehicle_number', label: 'Vehicle' },
      { key: 'vehicle_type', label: 'Type' },
      { key: 'trip_count', label: 'Trips', align: 'right' },
      { key: 'total_distance', label: 'Distance', align: 'right', render: (r) => `${formatNumber(r.total_distance)} km` },
      { key: 'total_fuel', label: 'Fuel', align: 'right', render: (r) => `${formatNumber(r.total_fuel, 1)} L` },
      { key: 'days_on_trip', label: 'Days used', align: 'right' },
      {
        key: 'utilisation_percent',
        label: 'Utilisation',
        render: (r) => (
          <div className="flex-row" style={{ gap: 8, flexWrap: 'nowrap' }}>
            <div className="progress-track" style={{ flex: 1 }}>
              <div className="progress-fill" style={{ width: `${Math.min(r.utilisation_percent, 100)}%` }} />
            </div>
            <span className="small nowrap">{r.utilisation_percent}%</span>
          </div>
        ),
      },
    ],
  },
  {
    key: 'fleet-availability',
    label: 'Fleet availability',
    filters: [],
    dataKey: 'by_type',
    columns: [
      { key: 'vehicle_type', label: 'Vehicle type' },
      { key: 'total', label: 'Total', align: 'right' },
      { key: 'available', label: 'Available', align: 'right' },
      { key: 'on_trip', label: 'On trip', align: 'right' },
      { key: 'under_maintenance', label: 'Under maintenance', align: 'right' },
      { key: 'out_of_service', label: 'Out of service', align: 'right' },
    ],
  },
  {
    key: 'upcoming-maintenance',
    label: 'Upcoming maintenance',
    filters: [],
    columns: [
      { key: 'vehicle_number', label: 'Vehicle' },
      { key: 'next_service_date', label: 'Next service', render: (r) => formatDate(r.next_service_date) },
      { key: 'days_remaining', label: 'Days remaining', align: 'right' },
      { key: 'current_odometer', label: 'Odometer', align: 'right', render: (r) => `${formatNumber(r.current_odometer)} km` },
      {
        key: 'risk_level',
        label: 'Forecast risk',
        render: (r) => (r.risk_level
          ? <span className={`risk-pill risk-${r.risk_level}`}>{r.risk_level}</span>
          : <span className="muted small">Not forecast</span>),
      },
      { key: 'status', label: 'Status', render: (r) => <span className={`badge ${statusBadge(r.status)}`}>{r.status}</span> },
    ],
  },
  {
    key: 'overdue-maintenance',
    label: 'Overdue maintenance',
    filters: [],
    columns: [
      { key: 'vehicle_number', label: 'Vehicle' },
      { key: 'next_service_date', label: 'Was due', render: (r) => formatDate(r.next_service_date) },
      {
        key: 'days_overdue',
        label: 'Days overdue',
        align: 'right',
        render: (r) => <span style={{ color: 'var(--red-600)', fontWeight: 600 }}>{r.days_overdue}</span>,
      },
      { key: 'current_odometer', label: 'Odometer', align: 'right', render: (r) => `${formatNumber(r.current_odometer)} km` },
      { key: 'last_service_date', label: 'Last service', render: (r) => formatDate(r.last_service_date) },
      { key: 'status', label: 'Status', render: (r) => <span className={`badge ${statusBadge(r.status)}`}>{r.status}</span> },
    ],
  },
  {
    key: 'repair-downtime',
    label: 'Repair downtime',
    filters: ['dates'],
    columns: [
      { key: 'vehicle_number', label: 'Vehicle' },
      { key: 'vehicle_type', label: 'Type' },
      { key: 'repair_count', label: 'Repairs', align: 'right' },
      { key: 'total_downtime', label: 'Total downtime', align: 'right', render: (r) => `${formatNumber(r.total_downtime, 1)} h` },
      { key: 'average_downtime', label: 'Average', align: 'right', render: (r) => `${formatNumber(r.average_downtime, 1)} h` },
      { key: 'longest_downtime', label: 'Longest', align: 'right', render: (r) => `${formatNumber(r.longest_downtime, 1)} h` },
    ],
  },
];

const MAINTENANCE_STATUSES = ['Scheduled', 'In Progress', 'Completed', 'Cancelled'];
const REPAIR_STATUSES = ['Open', 'In Progress', 'Completed', 'Cancelled'];

export default function Reports() {
  const [reportKey, setReportKey] = useState(REPORTS[0].key);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [vehicles, setVehicles] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({ vehicle_id: '', from: '', to: '', type: '', status: '' });

  const report = REPORTS.find((r) => r.key === reportKey);

  useEffect(() => {
    vehicleApi.listBasic().then(setVehicles).catch(() => {});
    // Maintenance types come from the service catalogue.
    maintenanceApi
      .serviceTypes()
      .then((s) => setTypes(s.map((x) => x.service_name)))
      .catch(() => {});
  }, []);

  const run = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (report.filters.includes('vehicle') && filters.vehicle_id) params.vehicle_id = filters.vehicle_id;
      if (report.filters.includes('dates')) {
        if (filters.from) params.from = filters.from;
        if (filters.to) params.to = filters.to;
      }
      if (report.filters.includes('type') && filters.type) params.type = filters.type;
      if (
        (report.filters.includes('maintenanceStatus') || report.filters.includes('repairStatus')) &&
        filters.status
      ) {
        params.status = filters.status;
      }

      const res = await reportApi.run(reportKey, params);
      const data = report.dataKey ? res.data[report.dataKey] : res.data;
      setRows(Array.isArray(data) ? data : []);
      setSummary(res.summary || {});
    } catch (err) {
      setError(err.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [reportKey, filters, report]);

  useEffect(() => {
    run();
  }, [run]);

  // Reset filters that do not apply when switching report.
  useEffect(() => {
    setFilters({ vehicle_id: '', from: '', to: '', type: '', status: '' });
  }, [reportKey]);

  /** Export the currently displayed rows as CSV. */
  const exportCsv = () => {
    if (rows.length === 0) return;
    const header = report.columns.map((c) => c.label);
    const body = rows.map((row) =>
      report.columns.map((c) => {
        const raw = row[c.key];
        const text = raw === null || raw === undefined ? '' : String(raw);
        return `"${text.replace(/"/g, '""')}"`;
      })
    );
    const csv = [header.join(','), ...body.map((r) => r.join(','))].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reportKey}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const setFilter = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  const summaryEntries = Object.entries(summary).filter(([, v]) => v !== null && v !== undefined);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Filter by vehicle, date range, type and status</p>
        </div>
        <div className="page-header-actions">
          <button
            type="button" className="btn btn-secondary"
            onClick={exportCsv} disabled={rows.length === 0}
          >
            ⬇ Export CSV
          </button>
          <button type="button" className="btn btn-primary" onClick={run} disabled={loading}>
            ↻ Run report
          </button>
        </div>
      </div>

      <Banner type="error" message={error} onClose={() => setError('')} />

      <div className="card mb-3">
        <div className="card-header">
          <div className="card-title">Report settings</div>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Report</label>
              <select
                className="form-control" value={reportKey}
                onChange={(e) => setReportKey(e.target.value)}
              >
                {REPORTS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </div>

            {report.filters.includes('vehicle') && (
              <div className="form-group">
                <label className="form-label">Vehicle</label>
                <select className="form-control" value={filters.vehicle_id} onChange={setFilter('vehicle_id')}>
                  <option value="">All vehicles</option>
                  {vehicles.map((v) => (
                    <option key={v.vehicle_id} value={v.vehicle_id}>{v.vehicle_number}</option>
                  ))}
                </select>
              </div>
            )}

            {report.filters.includes('dates') && (
              <>
                <div className="form-group">
                  <label className="form-label">From date</label>
                  <input type="date" className="form-control" value={filters.from} onChange={setFilter('from')} />
                </div>
                <div className="form-group">
                  <label className="form-label">To date</label>
                  <input type="date" className="form-control" value={filters.to} onChange={setFilter('to')} min={filters.from} />
                </div>
              </>
            )}

            {report.filters.includes('type') && (
              <div className="form-group">
                <label className="form-label">Maintenance type</label>
                <select className="form-control" value={filters.type} onChange={setFilter('type')}>
                  <option value="">All types</option>
                  {types.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}

            {report.filters.includes('maintenanceStatus') && (
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-control" value={filters.status} onChange={setFilter('status')}>
                  <option value="">All statuses</option>
                  {MAINTENANCE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            {report.filters.includes('repairStatus') && (
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-control" value={filters.status} onChange={setFilter('status')}>
                  <option value="">All statuses</option>
                  {REPAIR_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>

          {report.filters.length === 0 && (
            <p className="form-hint mt-3">This report has no filters — it always reflects the current fleet state.</p>
          )}
        </div>
      </div>

      {summaryEntries.length > 0 && (
        <div className="card mb-3">
          <div className="card-header">
            <div className="card-title">Summary</div>
          </div>
          <div className="card-body">
            <div className="detail-grid">
              {summaryEntries.map(([key, value]) => (
                <div className="detail-item" key={key}>
                  <div className="detail-label">{key.replace(/_/g, ' ')}</div>
                  <div className="detail-value">
                    {key.includes('cost')
                      ? formatCurrency(value)
                      : typeof value === 'number'
                        ? formatNumber(value, Number.isInteger(value) ? 0 : 1)
                        : String(value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="card-header" style={{ border: 'none', padding: '0 0 10px' }}>
        <div className="card-title">{report.label}</div>
        <div className="card-header-actions">
          <span className="muted small">{rows.length} rows</span>
        </div>
      </div>

      <DataTable
        columns={report.columns}
        rows={rows}
        loading={loading}
        rowKey={(r, i) => `${reportKey}-${i}`}
        emptyIcon="📊"
        emptyMessage="No data for the selected filters"
      />
    </>
  );
}
