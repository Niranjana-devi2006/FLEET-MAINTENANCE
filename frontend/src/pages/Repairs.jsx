import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

import { repairApi, vehicleApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import Banner from '../components/Banner';
import StatCard from '../components/StatCard';
import {
  formatCurrency, formatNumber, formatDate, statusBadge, toInputDate, todayInput,
} from '../utils/format';

const STATUSES = ['Open', 'In Progress', 'Completed', 'Cancelled'];

const EMPTY_FORM = {
  vehicle_id: '', repair_date: todayInput(), problem_description: '',
  repair_description: '', parts_replaced: '', repair_cost: '',
  downtime_hours: '', technician: '', status: 'Open', remarks: '',
};

export default function Repairs() {
  const { hasRole, user } = useAuth();
  const canEdit = hasRole('Admin', 'Fleet Manager', 'Technician');
  const canDelete = hasRole('Admin');

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 10 });
  const [vehicles, setVehicles] = useState([]);
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
  const [completing, setCompleting] = useState(null);

  useEffect(() => {
    vehicleApi.listBasic().then(setVehicles).catch((err) => setError(err.message));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await repairApi.list({
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

  const openEdit = (r) => {
    setEditing(r);
    setForm({
      vehicle_id: String(r.vehicle_id),
      repair_date: toInputDate(r.repair_date),
      problem_description: r.problem_description,
      repair_description: r.repair_description || '',
      parts_replaced: r.parts_replaced || '',
      repair_cost: r.repair_cost,
      downtime_hours: r.downtime_hours,
      technician: r.technician || '',
      status: r.status,
      remarks: r.remarks || '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const validate = () => {
    if (!form.vehicle_id) return 'Select a vehicle';
    if (!form.repair_date) return 'Repair date is required';
    if (form.problem_description.trim().length < 3) return 'Describe the problem';
    if (Number(form.repair_cost) < 0) return 'Repair cost cannot be negative';
    if (Number(form.downtime_hours) < 0) return 'Downtime hours cannot be negative';
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
        repair_date: form.repair_date,
        problem_description: form.problem_description.trim(),
        repair_description: form.repair_description || null,
        parts_replaced: form.parts_replaced || null,
        repair_cost: Number(form.repair_cost) || 0,
        downtime_hours: Number(form.downtime_hours) || 0,
        technician: form.technician || null,
        status: form.status,
        remarks: form.remarks || null,
      };

      if (editing) {
        await repairApi.update(editing.repair_id, payload);
        setNotice('Repair updated');
      } else {
        await repairApi.create(payload);
        setNotice(
          ['Open', 'In Progress'].includes(payload.status)
            ? 'Repair logged — vehicle moved to Under Maintenance'
            : 'Repair logged'
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

  const submitCompletion = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await repairApi.complete(completing.repair_id, {
        repair_description: completing.repair_description,
        parts_replaced: completing.parts_replaced,
        repair_cost: Number(completing.repair_cost) || 0,
        downtime_hours: Number(completing.downtime_hours) || 0,
        remarks: completing.remarks,
      });
      setNotice(`${completing.vehicle_number}: repair completed — vehicle released to Available`);
      setCompleting(null);
      load();
    } catch (err) {
      setError(err.message);
      setCompleting(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await repairApi.remove(confirmDelete.repair_id);
      setNotice('Repair record deleted');
      setConfirmDelete(null);
      load();
    } catch (err) {
      setError(err.message);
      setConfirmDelete(null);
    }
  };

  const summary = rows.reduce(
    (acc, r) => {
      acc.cost += Number(r.repair_cost || 0);
      acc.downtime += Number(r.downtime_hours || 0);
      if (['Open', 'In Progress'].includes(r.status)) acc.open += 1;
      return acc;
    },
    { cost: 0, downtime: 0, open: 0 }
  );

  const columns = [
    {
      key: 'vehicle',
      label: 'Vehicle',
      render: (r) => (
        <>
          <Link to={`/vehicles/${r.vehicle_id}`} className="strong">{r.vehicle_number}</Link>
          <div className="muted small nowrap">{formatDate(r.repair_date)}</div>
        </>
      ),
    },
    {
      key: 'problem_description',
      label: 'Problem / Repair',
      render: (r) => (
        <div style={{ maxWidth: 260 }}>
          <div className="strong small">{r.problem_description}</div>
          {r.repair_description && <div className="muted small">{r.repair_description}</div>}
        </div>
      ),
    },
    {
      key: 'parts_replaced',
      label: 'Parts replaced',
      render: (r) => <span className="small">{r.parts_replaced || '—'}</span>,
    },
    { key: 'repair_cost', label: 'Cost', align: 'right', render: (r) => formatCurrency(r.repair_cost) },
    {
      key: 'downtime_hours',
      label: 'Downtime',
      align: 'right',
      render: (r) => (
        <span style={{ color: Number(r.downtime_hours) >= 48 ? 'var(--red-600)' : undefined }}>
          {formatNumber(r.downtime_hours, 1)} h
        </span>
      ),
    },
    { key: 'technician', label: 'Technician', render: (r) => r.technician || '—' },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <span className={`badge ${statusBadge(r.status)}`}>{r.status}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (r) => (
        <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
          {canEdit && ['Open', 'In Progress'].includes(r.status) && (
            <button
              type="button" className="btn btn-success btn-sm"
              onClick={() => setCompleting({ ...r })} title="Complete repair"
            >
              ✓ Complete
            </button>
          )}
          {canEdit && (
            <button type="button" className="btn btn-secondary btn-icon" onClick={() => openEdit(r)} title="Edit">✎</button>
          )}
          {canDelete && (
            <button type="button" className="btn btn-danger btn-icon" onClick={() => setConfirmDelete(r)} title="Delete">🗑</button>
          )}
        </div>
      ),
    },
  ];

  const toolbar = (
    <>
      <input
        className="form-control search-input"
        placeholder="Search problem, parts or vehicle…"
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
          <h1 className="page-title">Repairs</h1>
          <p className="page-subtitle">
            {pagination.total} repair records · an open repair holds the vehicle Under Maintenance
          </p>
        </div>
        {canEdit && (
          <div className="page-header-actions">
            <button type="button" className="btn btn-primary" onClick={openCreate}>+ Log repair</button>
          </div>
        )}
      </div>

      <Banner type="error" message={error} onClose={() => setError('')} />
      <Banner type="success" message={notice} onClose={() => setNotice('')} />

      <div className="grid grid-stats mb-3">
        <StatCard label="Records" value={formatNumber(pagination.total)} hint="Matching your filters" icon="🛠" tone="blue" />
        <StatCard label="Open on page" value={formatNumber(summary.open)} hint="Open or in progress" icon="⚠" tone="red" />
        <StatCard label="Cost on page" value={formatCurrency(summary.cost)} hint="Sum of listed repairs" icon="₹" tone="amber" />
        <StatCard label="Downtime on page" value={`${formatNumber(summary.downtime, 1)} h`} hint="Hours off the road" icon="⏱" tone="purple" />
      </div>

      <DataTable
        columns={columns} rows={rows} loading={loading}
        rowKey={(r) => r.repair_id}
        toolbar={toolbar}
        emptyIcon="🛠"
        emptyMessage="No repairs match your filters"
        pagination={pagination}
        onPageChange={setPage}
      />

      {/* ------------ create / edit ------------ */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit repair #${editing.repair_id}` : 'Log repair'}
        size="wide"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" form="repair-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Log repair'}
            </button>
          </>
        }
      >
        <form id="repair-form" onSubmit={handleSubmit}>
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
            </div>
            <div className="form-group">
              <label className="form-label">Repair date<span className="req">*</span></label>
              <input
                name="repair_date" type="date" className="form-control"
                value={form.repair_date} onChange={handleChange} required
              />
            </div>
            <div className="form-group full">
              <label className="form-label">Problem description<span className="req">*</span></label>
              <textarea
                name="problem_description" className="form-control" value={form.problem_description}
                onChange={handleChange} placeholder="What went wrong?" required
              />
            </div>
            <div className="form-group full">
              <label className="form-label">Repair performed</label>
              <textarea
                name="repair_description" className="form-control" value={form.repair_description}
                onChange={handleChange} placeholder="What was done to fix it?"
              />
            </div>
            <div className="form-group full">
              <label className="form-label">Parts replaced</label>
              <input
                name="parts_replaced" className="form-control" value={form.parts_replaced}
                onChange={handleChange} placeholder="Alternator, drive belt"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Repair cost (₹)</label>
              <input
                name="repair_cost" type="number" min="0" step="0.01" className="form-control"
                value={form.repair_cost} onChange={handleChange} placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Downtime (hours)</label>
              <input
                name="downtime_hours" type="number" min="0" step="0.5" className="form-control"
                value={form.downtime_hours} onChange={handleChange} placeholder="0"
              />
              <span className="form-hint">48 h or more on an open repair raises a High alert.</span>
            </div>
            <div className="form-group">
              <label className="form-label">Technician</label>
              <input
                name="technician" className="form-control" value={form.technician}
                onChange={handleChange} placeholder="Arun Mehta"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select name="status" className="form-control" value={form.status} onChange={handleChange}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <span className="form-hint">
                Open/In Progress → Under Maintenance. Completed → Available.
              </span>
            </div>
            <div className="form-group full">
              <label className="form-label">Remarks</label>
              <textarea
                name="remarks" className="form-control" value={form.remarks}
                onChange={handleChange} placeholder="Parts on order, follow-up required…"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* ------------ completion form ------------ */}
      <Modal
        open={Boolean(completing)}
        onClose={() => setCompleting(null)}
        title={`Complete repair — ${completing?.vehicle_number || ''}`}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setCompleting(null)}>Cancel</button>
            <button type="submit" form="complete-form" className="btn btn-success" disabled={saving}>
              {saving ? 'Saving…' : 'Complete repair'}
            </button>
          </>
        }
      >
        {completing && (
          <form id="complete-form" onSubmit={submitCompletion}>
            <p className="muted small mb-3">
              <strong>Problem:</strong> {completing.problem_description}
            </p>
            <div className="form-grid">
              <div className="form-group full">
                <label className="form-label">Repair performed</label>
                <textarea
                  className="form-control" value={completing.repair_description || ''}
                  onChange={(e) => setCompleting((c) => ({ ...c, repair_description: e.target.value }))}
                  placeholder="Describe the work carried out"
                />
              </div>
              <div className="form-group full">
                <label className="form-label">Parts replaced</label>
                <input
                  className="form-control" value={completing.parts_replaced || ''}
                  onChange={(e) => setCompleting((c) => ({ ...c, parts_replaced: e.target.value }))}
                  placeholder="Radiator, upper hose, coolant"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Final cost (₹)</label>
                <input
                  type="number" min="0" step="0.01" className="form-control"
                  value={completing.repair_cost}
                  onChange={(e) => setCompleting((c) => ({ ...c, repair_cost: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Total downtime (hours)</label>
                <input
                  type="number" min="0" step="0.5" className="form-control"
                  value={completing.downtime_hours}
                  onChange={(e) => setCompleting((c) => ({ ...c, downtime_hours: e.target.value }))}
                />
              </div>
              <div className="form-group full">
                <label className="form-label">Remarks</label>
                <textarea
                  className="form-control" value={completing.remarks || ''}
                  onChange={(e) => setCompleting((c) => ({ ...c, remarks: e.target.value }))}
                />
              </div>
            </div>
            <p className="form-hint mt-3">
              Completing this releases {completing.vehicle_number} back to Available,
              unless other work is still outstanding.
            </p>
          </form>
        )}
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete repair record"
        size="narrow"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
            <button type="button" className="btn btn-danger" onClick={handleDelete}>Delete</button>
          </>
        }
      >
        <p>Delete this repair record for <strong>{confirmDelete?.vehicle_number}</strong>?</p>
      </Modal>
    </>
  );
}
