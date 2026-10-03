import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

import { tripApi, vehicleApi, driverApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import Banner from '../components/Banner';
import { formatNumber, formatDate, statusBadge, toInputDate, todayInput } from '../utils/format';

const STATUSES = ['Scheduled', 'Ongoing', 'Completed', 'Cancelled'];

const EMPTY_FORM = {
  vehicle_id: '', driver_id: '', start_location: '', destination: '',
  start_date: todayInput(), end_date: '', distance_km: '', fuel_consumed: '',
  trip_status: 'Scheduled',
};

export default function Trips() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('Admin', 'Fleet Manager');

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 10 });
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
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

  // Dropdown data, loaded once.
  useEffect(() => {
    Promise.all([vehicleApi.listBasic(), driverApi.listBasic()])
      .then(([v, d]) => { setVehicles(v); setDrivers(d); })
      .catch((err) => setError(err.message));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await tripApi.list({
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
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (t) => {
    setEditing(t);
    setForm({
      vehicle_id: String(t.vehicle_id),
      driver_id: String(t.driver_id),
      start_location: t.start_location,
      destination: t.destination,
      start_date: toInputDate(t.start_date),
      end_date: toInputDate(t.end_date),
      distance_km: t.distance_km,
      fuel_consumed: t.fuel_consumed,
      trip_status: t.trip_status,
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const validate = () => {
    if (!form.vehicle_id) return 'Select a vehicle';
    if (!form.driver_id) return 'Select a driver';
    if (!form.start_location.trim()) return 'Start location is required';
    if (!form.destination.trim()) return 'Destination is required';
    if (!form.start_date) return 'Start date is required';
    if (form.end_date && form.end_date < form.start_date) {
      return 'End date cannot be before the start date';
    }
    if (Number(form.distance_km) < 0) return 'Distance cannot be negative';
    if (Number(form.fuel_consumed) < 0) return 'Fuel consumed cannot be negative';
    if (form.trip_status === 'Completed' && !form.end_date) {
      return 'A completed trip needs an end date';
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
        driver_id: Number(form.driver_id),
        start_location: form.start_location.trim(),
        destination: form.destination.trim(),
        start_date: form.start_date,
        end_date: form.end_date || null,
        distance_km: Number(form.distance_km) || 0,
        fuel_consumed: Number(form.fuel_consumed) || 0,
        trip_status: form.trip_status,
      };

      if (editing) {
        await tripApi.update(editing.trip_id, payload);
        setNotice('Trip updated — vehicle and driver status adjusted automatically');
      } else {
        await tripApi.create(payload);
        setNotice('Trip created — vehicle marked On Trip');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  /** One-click completion from the list. */
  const completeTrip = async (trip) => {
    try {
      await tripApi.update(trip.trip_id, {
        trip_status: 'Completed',
        end_date: trip.end_date || todayInput(),
      });
      setNotice(`Trip completed — ${trip.vehicle_number} odometer advanced by ${formatNumber(trip.distance_km)} km`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await tripApi.remove(confirmDelete.trip_id);
      setNotice('Trip deleted');
      setConfirmDelete(null);
      load();
    } catch (err) {
      setError(err.message);
      setConfirmDelete(null);
    }
  };

  const columns = [
    {
      key: 'vehicle',
      label: 'Vehicle / Driver',
      render: (t) => (
        <>
          <Link to={`/vehicles/${t.vehicle_id}`} className="strong">{t.vehicle_number}</Link>
          <div className="muted small">{t.driver_name}</div>
        </>
      ),
    },
    {
      key: 'route',
      label: 'Route',
      render: (t) => (
        <>
          <div>{t.start_location} → {t.destination}</div>
          <div className="muted small nowrap">
            {formatDate(t.start_date)}{t.end_date ? ` → ${formatDate(t.end_date)}` : ''}
          </div>
        </>
      ),
    },
    {
      key: 'distance_km',
      label: 'Distance',
      align: 'right',
      render: (t) => `${formatNumber(t.distance_km)} km`,
    },
    {
      key: 'fuel_consumed',
      label: 'Fuel',
      align: 'right',
      render: (t) => `${formatNumber(t.fuel_consumed, 1)} L`,
    },
    {
      key: 'trip_status',
      label: 'Status',
      render: (t) => <span className={`badge ${statusBadge(t.trip_status)}`}>{t.trip_status}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (t) => (
        <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
          {canEdit && ['Scheduled', 'Ongoing'].includes(t.trip_status) && (
            <button
              type="button" className="btn btn-success btn-sm"
              onClick={() => completeTrip(t)} title="Mark completed"
            >
              ✓ Complete
            </button>
          )}
          {canEdit && (
            <button type="button" className="btn btn-secondary btn-icon" onClick={() => openEdit(t)} title="Edit">✎</button>
          )}
          {canEdit && (
            <button type="button" className="btn btn-danger btn-icon" onClick={() => setConfirmDelete(t)} title="Delete">🗑</button>
          )}
        </div>
      ),
    },
  ];

  const toolbar = (
    <>
      <input
        className="form-control search-input"
        placeholder="Search route, vehicle or driver…"
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
          <h1 className="page-title">Trips</h1>
          <p className="page-subtitle">
            {pagination.total} trips · completing a trip advances the vehicle odometer
          </p>
        </div>
        {canEdit && (
          <div className="page-header-actions">
            <button type="button" className="btn btn-primary" onClick={openCreate}>+ New trip</button>
          </div>
        )}
      </div>

      <Banner type="error" message={error} onClose={() => setError('')} />
      <Banner type="success" message={notice} onClose={() => setNotice('')} />

      <DataTable
        columns={columns} rows={rows} loading={loading}
        rowKey={(r) => r.trip_id}
        toolbar={toolbar}
        emptyIcon="🗺"
        emptyMessage="No trips match your filters"
        pagination={pagination}
        onPageChange={setPage}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit trip #${editing.trip_id}` : 'New trip'}
        size="wide"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" form="trip-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create trip'}
            </button>
          </>
        }
      >
        <form id="trip-form" onSubmit={handleSubmit}>
          <Banner type="error" message={formError} onClose={() => setFormError('')} />
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Vehicle<span className="req">*</span></label>
              <select
                name="vehicle_id" className="form-control"
                value={form.vehicle_id} onChange={handleChange} required
              >
                <option value="">Select a vehicle…</option>
                {vehicles.map((v) => (
                  <option key={v.vehicle_id} value={v.vehicle_id}>
                    {v.vehicle_number} — {v.manufacturer} {v.model} ({v.status})
                  </option>
                ))}
              </select>
              <span className="form-hint">
                Vehicles under maintenance or out of service cannot be assigned.
              </span>
            </div>
            <div className="form-group">
              <label className="form-label">Driver<span className="req">*</span></label>
              <select
                name="driver_id" className="form-control"
                value={form.driver_id} onChange={handleChange} required
              >
                <option value="">Select a driver…</option>
                {drivers.map((d) => (
                  <option key={d.driver_id} value={d.driver_id}>
                    {d.name} ({d.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Start location<span className="req">*</span></label>
              <input
                name="start_location" className="form-control" value={form.start_location}
                onChange={handleChange} placeholder="Bengaluru" required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Destination<span className="req">*</span></label>
              <input
                name="destination" className="form-control" value={form.destination}
                onChange={handleChange} placeholder="Chennai" required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Start date<span className="req">*</span></label>
              <input
                name="start_date" type="date" className="form-control"
                value={form.start_date} onChange={handleChange} required
              />
            </div>
            <div className="form-group">
              <label className="form-label">End date</label>
              <input
                name="end_date" type="date" className="form-control"
                value={form.end_date} onChange={handleChange} min={form.start_date}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Distance (km)</label>
              <input
                name="distance_km" type="number" min="0" step="0.01" className="form-control"
                value={form.distance_km} onChange={handleChange} placeholder="350"
              />
              <span className="form-hint">Added to the odometer once the trip completes.</span>
            </div>
            <div className="form-group">
              <label className="form-label">Fuel consumed (L)</label>
              <input
                name="fuel_consumed" type="number" min="0" step="0.01" className="form-control"
                value={form.fuel_consumed} onChange={handleChange} placeholder="62.5"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Trip status</label>
              <select
                name="trip_status" className="form-control"
                value={form.trip_status} onChange={handleChange}
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <span className="form-hint">
                Scheduled/Ongoing → vehicle On Trip. Completed → back to Available.
              </span>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete trip"
        size="narrow"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
            <button type="button" className="btn btn-danger" onClick={handleDelete}>Delete</button>
          </>
        }
      >
        <p>
          Delete the trip {confirmDelete?.start_location} → {confirmDelete?.destination}?
        </p>
        <p className="muted small mt-3">
          If it was completed, its distance will be removed from the vehicle odometer.
        </p>
      </Modal>
    </>
  );
}
