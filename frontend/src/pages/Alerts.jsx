import { useState, useEffect, useCallback } from 'react';

import { alertApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AlertCard from '../components/AlertCard';
import Loader from '../components/Loader';
import Banner from '../components/Banner';
import StatCard from '../components/StatCard';

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const STATUSES = ['Unread', 'Read', 'Resolved'];

export default function Alerts() {
  const { hasRole } = useAuth();
  const canManage = hasRole('Admin', 'Fleet Manager');

  const [alerts, setAlerts] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState(false);

  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await alertApi.list({
        priority: priorityFilter || undefined,
        status: statusFilter || undefined,
        limit: 200,
      });
      setAlerts(res.data);
      setMeta(res.meta || {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [priorityFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (fn, message) => {
    setWorking(true);
    setError('');
    try {
      await fn();
      if (message) setNotice(message);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  };

  const counts = PRIORITIES.reduce((acc, p) => {
    const found = (meta.priority_counts || []).find((r) => r.priority === p);
    acc[p] = found ? found.count : 0;
    return acc;
  }, {});

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Alerts</h1>
          <p className="page-subtitle">
            {meta.unread ?? 0} unread · generated from live maintenance, repair and licence conditions
          </p>
        </div>
        <div className="page-header-actions">
          <button
            type="button" className="btn btn-secondary" disabled={working}
            onClick={() => runAction(() => alertApi.markAllRead(), 'All alerts marked as read')}
          >
            ✓ Mark all read
          </button>
          {canManage && (
            <button
              type="button" className="btn btn-primary" disabled={working}
              onClick={() => runAction(() => alertApi.generate(), 'Alerts regenerated from current fleet conditions')}
            >
              {working ? <><span className="spinner sm" /> Working…</> : '⚡ Regenerate alerts'}
            </button>
          )}
        </div>
      </div>

      <Banner type="error" message={error} onClose={() => setError('')} />
      <Banner type="success" message={notice} onClose={() => setNotice('')} />

      <div className="grid grid-stats mb-3">
        <StatCard label="Critical" value={counts.Critical} hint="Immediate action" icon="⚠" tone="red" />
        <StatCard label="High" value={counts.High} hint="Needs attention soon" icon="↑" tone="amber" />
        <StatCard label="Medium" value={counts.Medium} hint="Plan ahead" icon="→" tone="blue" />
        <StatCard label="Low" value={counts.Low} hint="Informational" icon="·" tone="slate" />
      </div>

      <div className="card">
        <div className="table-toolbar">
          <select
            className="form-control" style={{ width: 'auto' }}
            value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            className="form-control" style={{ width: 'auto' }}
            value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {(priorityFilter || statusFilter) && (
            <button
              type="button" className="btn btn-secondary btn-sm"
              onClick={() => { setPriorityFilter(''); setStatusFilter(''); }}
            >
              Clear
            </button>
          )}
          <span className="muted small" style={{ marginLeft: 'auto' }}>
            {alerts.length} shown
          </span>
        </div>

        {loading ? (
          <Loader text="Loading alerts…" />
        ) : alerts.length === 0 ? (
          <div className="table-empty">
            <span className="table-empty-icon" aria-hidden="true">✓</span>
            No alerts match your filters
          </div>
        ) : (
          alerts.map((a) => (
            <AlertCard
              key={a.alert_id}
              alert={a}
              onMarkRead={(id) => runAction(() => alertApi.markRead(id))}
              onResolve={(id) => runAction(() => alertApi.resolve(id), 'Alert resolved')}
              onDelete={canManage ? (id) => runAction(() => alertApi.remove(id), 'Alert deleted') : undefined}
            />
          ))
        )}
      </div>
    </>
  );
}
