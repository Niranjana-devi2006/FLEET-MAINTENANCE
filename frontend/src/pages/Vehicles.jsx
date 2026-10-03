import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { vehicleApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import Banner from '../components/Banner';
import { formatNumber, formatDate, statusBadge, toInputDate, describeDays } from '../utils/format';

const STATUSES = ['Available', 'On Trip', 'Under Maintenance', 'Out of Service'];
const FUEL_TYPES = ['Diesel', 'Petrol', 'CNG', 'Electric', 'Hybrid'];
const VEHICLE_TYPES = ['Truck', 'Van', 'Bus', 'Car', 'Pickup', 'Electric', 'Trailer'];

const EMPTY_FORM = {
  vehicle_number: '', vehicle_type: 'Truck', manufacturer: '', model: '',
  purchase_date: '', registration_date: '', current_odometer: 0,
  fuel_type: 'Diesel', status: 'Available',
  last_service_date: '', next_service_date: '',
};

export default function Vehicles() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canEdit = hasRole('Admin', 'Fleet Manager');
  const canDelete = hasRole('Admin');

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await vehicleApi.list({
        search: search || undefined,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
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
  }, [search, statusFilter, typeFilter, page]);

  // Debounce so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(load, 300);
    return () => clearTimeout(id);
  }, [load]);

  useEffect(() => setPage(1), [search, statusFilter, typeFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (vehicle) => {
    setEditing(vehicle);
    setForm({
      vehicle_number: vehicle.vehicle_number,
      vehicle_type: vehicle.vehicle_type,
      manufacturer: vehicle.manufacturer,
      model: vehicle.model,
      purchase_date: toInputDate(vehicle.purchase_date),
      registration_date: toInputDate(vehicle.registration_date),
      current_odometer: vehicle.current_odometer,
      fuel_type: vehicle.fuel_type,
      status: vehicle.status,
      last_service_date: toInputDate(vehicle.last_service_date),
      next_service_date: toInputDate(vehicle.next_service_date),
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'number' ? value : value }));
  };

  const validate = () => {
    if (!form.vehicle_number.trim()) return 'Vehicle number is required';
    if (!form.manufacturer.trim()) return 'Manufacturer is required';
    if (!form.model.trim()) return 'Model is required';
    if (Number(form.current_odometer) < 0) return 'Odometer cannot be negative';
    if (
      form.last_service_date && form.next_service_date &&
      form.next_service_date < form.last_service_date
    ) {
      return 'Next service date cannot be before the last service date';
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
      // Blank date inputs must go over as null, not ''.
      const payload = {
        ...form,
        current_odometer: Number(form.current_odometer) || 0,
        purchase_date: form.purchase_date || null,
        registration_date: form.registration_date || null,
        last_service_date: form.last_service_date || null,
        next_service_date: form.next_service_date || null,
      };

      if (editing) {
        await vehicleApi.update(editing.vehicle_id, payload);
        setNotice(`${payload.vehicle_number} updated`);
      } else {
        await vehicleApi.create(payload);
        setNotice(`${payload.vehicle_number} added to the fleet`);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await vehicleApi.remove(confirmDelete.vehicle_id);
      setNotice(`${confirmDelete.vehicle_number} deleted`);
      setConfirmDelete(null);
      load();
    } catch (err) {
      setError(err.message);
      setConfirmDelete(null);
    }
  };

  const columns = [
    {
      key: 'vehicle_number',
      label: 'Vehicle',
      render: (v) => (
        <>
          <div className="strong">{v.vehicle_number}</div>
          <div className="muted small">{v.manufacturer} {v.model}</div>
        </>
      ),
    },
    { key: 'vehicle_type', label: 'Type' },
    { key: 'fuel_type', label: 'Fuel' },
    {
      key: 'current_odometer',
      label: 'Odometer',
      align: 'right',
      render: (v) => `${formatNumber(v.current_odometer)} km`,
    },
    {
      key: 'next_service_date',
      label: 'Next service',
      render: (v) => {
        if (!v.next_service_date) return <span className="muted">Not set</span>;
        const days = Math.round(
          (new Date(`${v.next_service_date}T00:00:00`) - new Date().setHours(0, 0, 0, 0)) / 86400000
        );
        return (
          <>
            <div className="nowrap">{formatDate(v.next_service_date)}</div>
            <div className="small" style={{ color: days < 0 ? 'var(--red-600)' : 'var(--text-muted)' }}>
              {describeDays(days)}
            </div>
          </>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <span className={`badge ${statusBadge(v.status)}`}>{v.status}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (v) => (
        <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
          <button
            type="button" className="btn btn-secondary btn-icon" title="View details"
            onClick={(e) => { e.stopPropagation(); navigate(`/vehicles/${v.vehicle_id}`); }}
          >
            👁
          </button>
          {canEdit && (
            <button
              type="button" className="btn btn-secondary btn-icon" title="Edit"
              onClick={(e) => { e.stopPropagation(); openEdit(v); }}
            >
              ✎
            </button>
          )}
          {canDelete && (
            <button
              type="button" className="btn btn-danger btn-icon" title="Delete"
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(v); }}
            >
              🗑
            </button>
          )}
        </div>
      ),
    },
  ];

  const toolbar = (
    <>
      <input
        className="form-control search-input"
        placeholder="Search vehicle number, make or model…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
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
        value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
      >
        <option value="">All types</option>
        {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      {(search || statusFilter || typeFilter) && (
        <button
          type="button" className="btn btn-secondary btn-sm"
          onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter(''); }}
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
          <h1 className="page-title">Vehicles</h1>
          <p className="page-subtitle">{pagination.total} vehicles in the register</p>
        </div>
        {canEdit && (
          <div className="page-header-actions">
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              + Add vehicle
            </button>
          </div>
        )}
      </div>

      <Banner type="error" message={error} onClose={() => setError('')} />
      <Banner type="success" message={notice} onClose={() => setNotice('')} />

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        rowKey={(r) => r.vehicle_id}
        onRowClick={(r) => navigate(`/vehicles/${r.vehicle_id}`)}
        toolbar={toolbar}
        emptyIcon="🚚"
        emptyMessage="No vehicles match your filters"
        pagination={pagination}
        onPageChange={setPage}
      />

      {/* ------------ create / edit ------------ */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.vehicle_number}` : 'Add vehicle'}
        size="wide"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="vehicle-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add vehicle'}
            </button>
          </>
        }
      >
        <form id="vehicle-form" onSubmit={handleSubmit}>
          <Banner type="error" message={formError} onClose={() => setFormError('')} />

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Vehicle number<span className="req">*</span></label>
              <input
                name="vehicle_number" className="form-control" value={form.vehicle_number}
                onChange={handleChange} placeholder="KA01AB1234" required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Vehicle type<span className="req">*</span></label>
              <select name="vehicle_type" className="form-control" value={form.vehicle_type} onChange={handleChange}>
                {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Manufacturer<span className="req">*</span></label>
              <input
                name="manufacturer" className="form-control" value={form.manufacturer}
                onChange={handleChange} placeholder="Tata" required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Model<span className="req">*</span></label>
              <input
                name="model" className="form-control" value={form.model}
                onChange={handleChange} placeholder="LPT 1618" required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Fuel type</label>
              <select name="fuel_type" className="form-control" value={form.fuel_type} onChange={handleChange}>
                {FUEL_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select name="status" className="form-control" value={form.status} onChange={handleChange}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <span className="form-hint">Trips and repairs also change this automatically.</span>
            </div>
            <div className="form-group">
              <label className="form-label">Current odometer (km)</label>
              <input
                name="current_odometer" type="number" min="0" className="form-control"
                value={form.current_odometer} onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Purchase date</label>
              <input
                name="purchase_date" type="date" className="form-control"
                value={form.purchase_date} onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Registration date</label>
              <input
                name="registration_date" type="date" className="form-control"
                value={form.registration_date} onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Last service date</label>
              <input
                name="last_service_date" type="date" className="form-control"
                value={form.last_service_date} onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Next service date</label>
              <input
                name="next_service_date" type="date" className="form-control"
                value={form.next_service_date} onChange={handleChange}
              />
              <span className="form-hint">Drives the due/overdue alerts.</span>
            </div>
          </div>
        </form>
      </Modal>

      {/* ------------ delete confirmation ------------ */}
      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete vehicle"
        size="narrow"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={handleDelete}>
              Delete permanently
            </button>
          </>
        }
      >
        <p>
          Delete <strong>{confirmDelete?.vehicle_number}</strong>? Its trips, maintenance
          records, repairs, forecasts and alerts will be removed as well.
        </p>
        <p className="muted small mt-3">This cannot be undone.</p>
      </Modal>
    </>
  );
}
