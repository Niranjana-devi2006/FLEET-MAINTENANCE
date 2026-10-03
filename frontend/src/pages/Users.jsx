import { useState, useEffect } from 'react';

import { userApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import Banner from '../components/Banner';
import StatCard from '../components/StatCard';
import { formatDate, initials } from '../utils/format';

const ROLE_LIST = ['Admin', 'Fleet Manager', 'Technician'];
const ROLE_BADGE = { Admin: 'badge-purple', 'Fleet Manager': 'badge-blue', Technician: 'badge-amber' };

const EMPTY_FORM = { name: '', email: '', phone: '', role: 'Fleet Manager', password: '' };

export default function Users() {
  const { user: currentUser } = useAuth();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = () => {
    setLoading(true);
    setError('');
    userApi
      .list()
      .then(setRows)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      phone: u.phone || '',
      role: u.role,
      password: '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.name.trim().length < 2) return setFormError('Name is required');
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setFormError('A valid email address is required');
    if (!editing && form.password.length < 6) {
      return setFormError('Password must be at least 6 characters');
    }
    if (editing && form.password && form.password.length < 6) {
      return setFormError('New password must be at least 6 characters');
    }

    setSaving(true);
    setFormError('');
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone || null,
        role: form.role,
      };
      if (form.password) payload.password = form.password;

      if (editing) {
        await userApi.update(editing.user_id, payload);
        setNotice(`${payload.name} updated`);
      } else {
        await userApi.create(payload);
        setNotice(`${payload.name} added as ${payload.role}`);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await userApi.remove(confirmDelete.user_id);
      setNotice(`${confirmDelete.name} deleted`);
      setConfirmDelete(null);
      load();
    } catch (err) {
      setError(err.message);
      setConfirmDelete(null);
    }
  };

  const filtered = rows.filter((u) => {
    const matchesSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = !roleFilter || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const roleCount = (role) => rows.filter((u) => u.role === role).length;

  const columns = [
    {
      key: 'name',
      label: 'User',
      render: (u) => (
        <div className="flex-row" style={{ flexWrap: 'nowrap' }}>
          <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
            {initials(u.name)}
          </div>
          <div>
            <div className="strong">
              {u.name}
              {u.user_id === currentUser?.user_id && (
                <span className="badge badge-slate" style={{ marginLeft: 7 }}>You</span>
              )}
            </div>
            <div className="muted small">{u.email}</div>
          </div>
        </div>
      ),
    },
    { key: 'phone', label: 'Phone', render: (u) => u.phone || '—' },
    {
      key: 'role',
      label: 'Role',
      render: (u) => <span className={`badge ${ROLE_BADGE[u.role]}`}>{u.role}</span>,
    },
    { key: 'created_at', label: 'Created', render: (u) => formatDate(u.created_at) },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (u) => (
        <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary btn-icon" onClick={() => openEdit(u)} title="Edit">✎</button>
          <button
            type="button" className="btn btn-danger btn-icon"
            onClick={() => setConfirmDelete(u)} title="Delete"
            disabled={u.user_id === currentUser?.user_id}
          >
            🗑
          </button>
        </div>
      ),
    },
  ];

  const toolbar = (
    <>
      <input
        className="form-control search-input"
        placeholder="Search name or email…"
        value={search} onChange={(e) => setSearch(e.target.value)}
      />
      <select
        className="form-control" style={{ width: 'auto' }}
        value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
      >
        <option value="">All roles</option>
        {ROLE_LIST.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      {(search || roleFilter) && (
        <button
          type="button" className="btn btn-secondary btn-sm"
          onClick={() => { setSearch(''); setRoleFilter(''); }}
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
          <h1 className="page-title">User management</h1>
          <p className="page-subtitle">{rows.length} accounts</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary" onClick={openCreate}>+ Add user</button>
        </div>
      </div>

      <Banner type="error" message={error} onClose={() => setError('')} />
      <Banner type="success" message={notice} onClose={() => setNotice('')} />

      <div className="grid grid-stats mb-3">
        <StatCard label="Total users" value={rows.length} hint="All accounts" icon="👥" tone="blue" />
        <StatCard label="Administrators" value={roleCount('Admin')} hint="Full access" icon="🛡" tone="purple" />
        <StatCard label="Fleet managers" value={roleCount('Fleet Manager')} hint="Operations" icon="📋" tone="green" />
        <StatCard label="Technicians" value={roleCount('Technician')} hint="Workshop" icon="🔧" tone="amber" />
      </div>

      <DataTable
        columns={columns} rows={filtered} loading={loading}
        rowKey={(r) => r.user_id}
        toolbar={toolbar}
        emptyIcon="👥"
        emptyMessage="No users match your filters"
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'Add user'}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" form="user-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create user'}
            </button>
          </>
        }
      >
        <form id="user-form" onSubmit={handleSubmit}>
          <Banner type="error" message={formError} onClose={() => setFormError('')} />
          <div className="form-grid">
            <div className="form-group full">
              <label className="form-label">Full name<span className="req">*</span></label>
              <input name="name" className="form-control" value={form.name} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email<span className="req">*</span></label>
              <input
                name="email" type="email" className="form-control"
                value={form.email} onChange={handleChange} required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input name="phone" className="form-control" value={form.phone} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Role<span className="req">*</span></label>
              <select name="role" className="form-control" value={form.role} onChange={handleChange}>
                {ROLE_LIST.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">
                Password{!editing && <span className="req">*</span>}
              </label>
              <input
                name="password" type="password" className="form-control"
                value={form.password} onChange={handleChange}
                placeholder={editing ? 'Leave blank to keep current' : 'At least 6 characters'}
                required={!editing}
              />
            </div>
          </div>
          {editing && (
            <p className="form-hint mt-3">
              Technicians see work matched on their account name, so renaming a
              technician also changes which jobs appear in their queue.
            </p>
          )}
        </form>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete user"
        size="narrow"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
            <button type="button" className="btn btn-danger" onClick={handleDelete}>Delete</button>
          </>
        }
      >
        <p>Delete the account for <strong>{confirmDelete?.name}</strong> ({confirmDelete?.email})?</p>
        <p className="muted small mt-3">The last remaining administrator cannot be deleted.</p>
      </Modal>
    </>
  );
}
