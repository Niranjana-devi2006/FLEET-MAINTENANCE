import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

import { maintenanceApi, vehicleApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import Banner from '../components/Banner';
import StatCard from '../components/StatCard';
import {
  formatCurrency, formatNumber, formatDate, statusBadge, toInputDate, todayInput,
} from '../utils/format';

const STATUSES = ['Scheduled', 'In Progress', 'Completed', 'Cancelled'];

const EMPTY_FORM = {
  vehicle_id: '', maintenance_type: 'Routine Service', service_date: todayInput(),
  odometer_reading: '', description: '', service_cost: '',
  next_service_date: '', next_service_odometer: '',
  status: 'Scheduled', technician: '', remarks: '',
};

export default function Maintenance() {
  const { hasRole, user } = useAuth();
  const canCreate = hasRole('Admin', 'Fleet Manager');
  const canEdit = hasRole('Admin', 'Fleet Manager', 'Technician');
  const canDelete = hasRole('Admin');

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 10 });
  const [vehicles, setVehicles] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    Promise.all([vehicleApi.listBasic(), maintenanceApi.serviceTypes()])
      .then(([v, s]) => { setVehicles(v); setServiceTypes(s); })
      .catch((err) => setError(err.message));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await maintenanceApi.list({
        search: search || undefined,
        status: statusFilter || undefined,
        vehicle_id: vehicleFilter || undefined,
        page,
        limit: 10,
      });
      setRows(res.data);
      setPagination(res.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, vehicleFilter, page]);

  useEffect(() => {
    const id = setTimeout(load, 300);
    return () => clearTimeout(id);
  }, [load]);

  useEffect(() => setPage(1), [search, statusFilter, vehicleFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, technician: user?.role === 'Technician' ? user.name : '' });
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (m) => {
    setEditing(m);
    setForm({
      vehicle_id: String(m.vehicle_id),
      maintenance_type: m.maintenance_type,
      service_date: toInputDate(m.service_date),
      odometer_reading: m.odometer_reading,
      description: m.description || '',
      service_cost: m.service_cost,
      next_service_date: toInputDate(m.next_service_date),
      next_service_odometer: m.next_service_odometer ?? '',
      status: m.status,
      technician: m.technician || '',
      remarks: m.remarks || '',
    });
    setFormError('');
    setModalOpen(true);
  };

  /** Prefill the odometer from the selected vehicle's current reading. */
  const handleVehicleChange = (e) => {
    const vehicleId = e.target.value;
    const vehicle = vehicles.find((v) => String(v.vehicle_id) === vehicleId);
    setForm((f) => ({
      ...f,
      vehicle_id: vehicleId,
      odometer_reading: f.odometer_reading || (vehicle ? vehicle.current_odometer : ''),
    }));
  };

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const validate = () => {
    if (!form.vehicle_id) return 'Select a vehicle';
    if (!form.maintenance_type.trim()) return 'Maintenance type is required';
    if (!form.service_date) return 'Service date is required';
    if (Number(form.service_cost) < 0) return 'Maintenance cost cannot be negative';
    if (Number(form.odometer_reading) < 0) return 'Odometer reading cannot be negative';
    if (form.next_service_odometer !== '' && Number(form.next_service_odometer) < 0) {
      return 'Next service odometer cannot be negative';
    }
    if (form.next_service_date && form.next_service_date < form.service_date) {
      return 'Next service date cannot be before the service date';
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setFormError(problem);
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const payload = {
        vehicle_id: Number(form.vehicle_id),
        maintenance_type: form.maintenance_type.trim(),
        service_date: form.service_date,
        odometer_reading: Number(form.odometer_reading) || 0,
        description: form.description || null,
        service_cost: Number(form.service_cost) || 0,
        next_service_date: form.next_service_date || null,
        next_service_odometer:
          form.next_service_odometer === '' ? null : Number(form.next_service_odometer),
        status: form.status,
        technician: form.technician || null,
        remarks: form.remarks || null,
      };

      if (editing) {
        await maintenanceApi.update(editing.maintenance_id, payload);
        setNotice('Maintenance record updated');
      } else {
        await maintenanceApi.create(payload);
        setNotice(
          payload.status === 'Completed'
            ? 'Service recorded — vehicle service dates rolled forward'
            : 'Maintenance scheduled'
        );
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  /** Technician shortcut: mark a job complete from the list. */
  const markComplete = async (m) => {
    try {
      await maintenanceApi.update(m.maintenance_id, { status: 'Completed' });
      setNotice(`${m.vehicle_number}: ${m.maintenance_type} marked complete`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await maintenanceApi.remove(confirmDelete.maintenance_id);
      setNotice('Maintenance record deleted');
      setConfirmDelete(null);
      load();
    } catch (err) {
      setError(err.message);
      setConfirmDelete(null);
    }
  };

  const summary = rows.reduce(
    (acc, r) => {
      acc.cost += Number(r.service_cost || 0);
      if (r.status === 'Scheduled') acc.scheduled += 1;
      if (r.status === 'In Progress') acc.inProgress += 1;
      return acc;
    },
    { cost: 0, scheduled: 0, inProgress: 0 }
  );

  const columns = [
    {
      key: 'vehicle',
      label: 'Vehicle',
      render: (m) => (
        <>
          <Link to={`/vehicles/${m.vehicle_id}`} className="strong">{m.vehicle_number}</Link>
          <div className="muted small">{m.manufacturer} {m.model}</div>
        </>
      ),
    },
    {
      key: 'maintenance_type',
      label: 'Service type',
      render: (m) => (
        <>
          <div>{m.maintenance_type}</div>
          {m.description && (
            <div className="muted small" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.description}
            </div>
          )}
        </>
      ),
    },
    { key: 'service_date', label: 'Date', render: (m) => formatDate(m.service_date), className: 'nowrap' },
    {
      key: 'odometer_reading',
      label: 'Odometer',
      align: 'right',
      render: (m) => `${formatNumber(m.odometer_reading)} km`,
    },
    {
      key: 'service_cost',
      label: 'Cost',
      align: 'right',
      render: (m) => formatCurrency(m.service_cost),
    },
    { key: 'technician', label: 'Technician', render: (m) => m.technician || '—' },
    {
      key: 'next',
      label: 'Next service',
      render: (m) => (
        <>
          <div className="nowrap small">{formatDate(m.next_service_date)}</div>
          {m.next_service_odometer && (
            <div className="muted small">{formatNumber(m.next_service_odometer)} km</div>
          )}
        </>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (m) => <span className={`badge ${statusBadge(m.status)}`}>{m.status}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (m) => (
        <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
          {canEdit && ['Scheduled', 'In Progress'].includes(m.status) && (
            <button
              type="button" className="btn btn-success btn-sm"
              onClick={() => markComplete(m)} title="Mark complete"
            >
              ✓
            </button>
          )}
          {canEdit && (
            <button type="button" className="btn btn-secondary btn-icon" onClick={() => openEdit(m)} title="Edit">✎</button>
          )}
          {canDelete && (
            <button type="button" className="btn btn-danger btn-icon" onClick={() => setConfirmDelete(m)} title="Delete">🗑</button>
          )}
        </div>
      ),
    },
  ];

  const toolbar = (
    <>
      <input
        className="form-control search-input"
        placeholder="Search type, description, vehicle or technician…"
        value={search} onChange={(e) => setSearch(e.target.value)}
      />
      <select
        className="form-control" style={{ width: 'auto' }}
        value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
      >
        <option value="">All statuses</option>
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <select
        className="form-control" style={{ width: 'auto' }}
        value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)}
      >
        <option value="">All vehicles</option>
        {vehicles.map((v) => (
          <option key={v.vehicle_id} value={v.vehicle_id}>{v.vehicle_number}</option>
        ))}
      </select>
      {(search || statusFilter || vehicleFilter) && (
        <button
          type="button" className="btn btn-secondary btn-sm"
          onClick={() => { setSearch(''); setStatusFilter(''); setVehicleFilter(''); }}
        >
          Clear
        </button>
      )}
    </>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Maintenance</h1>
          <p className="page-subtitle">{pagination.total} service records</p>
        </div>
        {canCreate && (
          <div className="page-header-actions">
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              + Schedule maintenance
            </button>
          </div>
        )}
      </div>

      <Banner type="error" message={error} onClose={() => setError('')} />
      <Banner type="success" message={notice} onClose={() => setNotice('')} />

      <div className="grid grid-stats mb-3">
        <StatCard label="Records" value={formatNumber(pagination.total)} hint="Matching your filters" icon="🔧" tone="blue" />
        <StatCard label="Scheduled" value={formatNumber(summary.scheduled)} hint="On this page" icon="📅" tone="purple" />
        <StatCard label="In progress" value={formatNumber(summary.inProgress)} hint="On this page" icon="⏳" tone="amber" />
        <StatCard label="Cost on page" value={formatCurrency(summary.cost)} hint="Sum of listed records" icon="₹" tone="green" />
      </div>

      <DataTable
        columns={columns} rows={rows} loading={loading}
        rowKey={(r) => r.maintenance_id}
        toolbar={toolbar}
        emptyIcon="🔧"
        emptyMessage="No maintenance records match your filters"
        pagination={pagination}
        onPageChange={setPage}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit service #${editing.maintenance_id}` : 'Schedule maintenance'}
        size="wide"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" form="maint-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Save record'}
            </button>
          </>
        }
      >
        <form id="maint-form" onSubmit={handleSubmit}>
          <Banner type="error" message={formError} onClose={() => setFormError('')} />
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Vehicle<span className="req">*</span></label>
              <select
                name="vehicle_id" className="form-control"
                value={form.vehicle_id} onChange={handleVehicleChange} required
              >
                <option value="">Select a vehicle…</option>
                {vehicles.map((v) => (
                  <option key={v.vehicle_id} value={v.vehicle_id}>
                    {v.vehicle_number} — {formatNumber(v.current_odometer)} km
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Service type<span className="req">*</span></label>
              <select
                name="maintenance_type" className="form-control"
                value={form.maintenance_type} onChange={handleChange} required
              >
                {serviceTypes.map((s) => (
                  <option key={s.service_type_id} value={s.service_name}>
                    {s.service_name} ({formatNumber(s.service_interval_km)} km / {s.service_interval_days}d)
                  </option>
                ))}
              </select>
              <span className="form-hint">
                Leave the next-service fields blank and they are derived from this interval.
              </span>
            </div>
            <div className="form-group">
              <label className="form-label">Service date<span className="req">*</span></label>
              <input
                name="service_date" type="date" className="form-control"
                value={form.service_date} onChange={handleChange} required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Odometer reading (km)</label>
              <input
                name="odometer_reading" type="number" min="0" className="form-control"
                value={form.odometer_reading} onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Service cost (₹)</label>
              <input
                name="service_cost" type="number" min="0" step="0.01" className="form-control"
                value={form.service_cost} onChange={handleChange} placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Technician</label>
              <input
                name="technician" className="form-control" value={form.technician}
                onChange={handleChange} placeholder="Arun Mehta"
              />
              <span className="form-hint">Matches the technician's own work queue by name.</span>
            </div>
            <div className="form-group">
              <label className="form-label">Next service date</label>
              <input
                name="next_service_date" type="date" className="form-control"
                value={form.next_service_date} onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Next service odometer (km)</label>
              <input
                name="next_service_odometer" type="number" min="0" className="form-control"
                value={form.next_service_odometer} onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select name="status" className="form-control" value={form.status} onChange={handleChange}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <span className="form-hint">
                In Progress → vehicle Under Maintenance. Completed → released.
              </span>
            </div>
            <div className="form-group full">
              <label className="form-label">Description</label>
              <textarea
                name="description" className="form-control" value={form.description}
                onChange={handleChange} placeholder="What work is being carried out?"
              />
            </div>
            <div className="form-group full">
              <label className="form-label">Remarks</label>
              <textarea
                name="remarks" className="form-control" value={form.remarks}
                onChange={handleChange} placeholder="Observations, follow-up needed, parts on order…"
              />
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete maintenance record"
        size="narrow"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
            <button type="button" className="btn btn-danger" onClick={handleDelete}>Delete</button>
          </>
        }
      >
        <p>
          Delete the <strong>{confirmDelete?.maintenance_type}</strong> record for{' '}
          <strong>{confirmDelete?.vehicle_number}</strong>?
        </p>
        <p className="muted small mt-3">
          This removes it from the service history the forecaster reads.
        </p>
      </Modal>
    </>
  );
}
