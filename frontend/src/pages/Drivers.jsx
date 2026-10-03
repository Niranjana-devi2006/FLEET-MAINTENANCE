import { useState, useEffect, useCallback } from 'react';

import { driverApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import Banner from '../components/Banner';
import { formatDate, statusBadge, toInputDate, describeDays } from '../utils/format';

const STATUSES = ['Active', 'On Trip', 'Inactive', 'Suspended'];
const EMPTY_FORM = { name: '', license_number: '', phone: '', license_expiry: '', status: 'Active' };

export default function Drivers() {
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
      const res = await driverApi.list({
        search: search || undefined,
        status: statusFilter || undefined,
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
  }, [search, statusFilter, page]);

  useEffect(() => {
    const id = setTimeout(load, 300);
    return () => clearTimeout(id);
  }, [load]);

  useEffect(() => setPage(1), [search, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (d) => {
    setEditing(d);
    setForm({
      name: d.name,
      license_number: d.license_number,
      phone: d.phone || '',
      license_expiry: toInputDate(d.license_expiry),
      status: d.status,
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.name.trim().length < 2) {
      setFormError('Driver name is required');
      return;
    }
    if (form.license_number.trim().length < 3) {
      setFormError('License number is required');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const payload = {
        ...form,
        phone: form.phone || null,
        license_expiry: form.license_expiry || null,
      };
      if (editing) {
        await driverApi.update(editing.driver_id, payload);
        setNotice(`${payload.name} updated`);
      } else {
        await driverApi.create(payload);
        setNotice(`${payload.name} added`);
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
      await driverApi.remove(confirmDelete.driver_id);
      setNotice(`${confirmDelete.name} deleted`);
      setConfirmDelete(null);
      load();
    } catch (err) {
      setError(err.message);
      setConfirmDelete(null);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Driver',
      render: (d) => (
        <>
          <div className="strong">{d.name}</div>
          <div className="muted small">{d.phone || 'No phone on record'}</div>
        </>
      ),
    },
    { key: 'license_number', label: 'License number', className: 'mono small' },
    {
      key: 'license_expiry',
      label: 'License expiry',
      render: (d) => {
        if (!d.license_expiry) return <span className="muted">Not set</span>;
        const days = d.license_days_remaining;
        const expired = days < 0;
        return (
          <>
            <div className="nowrap">{formatDate(d.license_expiry)}</div>
            <div
              className="small"
              style={{ color: expired ? 'var(--red-600)' : days <= 30 ? 'var(--amber-600)' : 'var(--text-muted)' }}
            >
              {expired ? `Expired ${Math.abs(days)} days ago` : describeDays(days)}
            </div>
          </>
        );
      },
    },
    { key: 'total_trips', label: 'Trips', align: 'right' },
    {
      key: 'status',
      label: 'Status',
      render: (d) => <span className={`badge ${statusBadge(d.status)}`}>{d.status}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (d) => (
        <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
          {canEdit && (
            <button type="button" className="btn btn-secondary btn-icon" onClick={() => openEdit(d)} title="Edit">✎</button>
          )}
          {canDelete && (
            <button type="button" className="btn btn-danger btn-icon" onClick={() => setConfirmDelete(d)} title="Delete">🗑</button>
          )}
        </div>
      ),
    },
  ];

  const toolbar = (
    <>
      <input
        className="form-control search-input"
        placeholder="Search name, licence or phone…"
        value={search} onChange={(e) => setSearch(e.target.value)}
      />
      <select
        className="form-control" style={{ width: 'auto' }}
        value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
      >
        <option value="">All statuses</option>
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      {(search || statusFilter) && (
        <button
          type="button" className="btn btn-secondary btn-sm"
          onClick={() => { setSearch(''); setStatusFilter(''); }}
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
          <h1 className="page-title">Drivers</h1>
          <p className="page-subtitle">{pagination.total} drivers on record</p>
        </div>
        {canEdit && (
          <div className="page-header-actions">
            <button type="button" className="btn btn-primary" onClick={openCreate}>+ Add driver</button>
          </div>
        )}
      </div>

      <Banner type="error" message={error} onClose={() => setError('')} />
      <Banner type="success" message={notice} onClose={() => setNotice('')} />

      <DataTable
        columns={columns} rows={rows} loading={loading}
        rowKey={(r) => r.driver_id}
        toolbar={toolbar}
        emptyIcon="👤"
        emptyMessage="No drivers match your filters"
        pagination={pagination}
        onPageChange={setPage}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'Add driver'}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" form="driver-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add driver'}
            </button>
          </>
        }
      >
        <form id="driver-form" onSubmit={handleSubmit}>
          <Banner type="error" message={formError} onClose={() => setFormError('')} />
          <div className="form-grid">
            <div className="form-group full">
              <label className="form-label">Full name<span className="req">*</span></label>
              <input
                name="name" className="form-control" value={form.name}
                onChange={handleChange} placeholder="Suresh Naidu" required
              />
            </div>
            <div className="form-group">
              <label className="form-label">License number<span className="req">*</span></label>
              <input
                name="license_number" className="form-control" value={form.license_number}
                onChange={handleChange} placeholder="DL-KA-2019-004512" required
              />
              <span className="form-hint">Must be unique across all drivers.</span>
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                name="phone" className="form-control" value={form.phone}
                onChange={handleChange} placeholder="+91-98123 45601"
              />
            </div>
            <div className="form-group">
              <label className="form-label">License expiry</label>
              <input
                name="license_expiry" type="date" className="form-control"
                value={form.license_expiry} onChange={handleChange}
              />
              <span className="form-hint">An expiring licence raises an alert.</span>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select name="status" className="form-control" value={form.status} onChange={handleChange}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete driver"
        size="narrow"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
            <button type="button" className="btn btn-danger" onClick={handleDelete}>Delete</button>
          </>
        }
      >
        <p>Delete <strong>{confirmDelete?.name}</strong>?</p>
        <p className="muted small mt-3">
          Drivers referenced by existing trips cannot be deleted — set them to Inactive instead.
        </p>
      </Modal>
    </>
  );
}
