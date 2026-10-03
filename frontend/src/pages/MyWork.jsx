import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

import { maintenanceApi, repairApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Loader from '../components/Loader';
import Banner from '../components/Banner';
import Modal from '../components/Modal';
import StatCard from '../components/StatCard';
import { formatCurrency, formatNumber, formatDate, statusBadge } from '../utils/format';

/**
 * The Technician workspace: everything assigned to the signed-in user by name,
 * with inline controls to move work forward.
 */
export default function MyWork() {
  const { user } = useAuth();

  const [maintenance, setMaintenance] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [completing, setCompleting] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await maintenanceApi.assignedToMe();
      setMaintenance(res.maintenance);
      setRepairs(res.repairs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateMaintenanceStatus = async (record, status) => {
    try {
      await maintenanceApi.update(record.maintenance_id, { status });
      setNotice(`${record.vehicle_number}: ${record.maintenance_type} → ${status}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const startRepair = async (repair) => {
    try {
      await repairApi.update(repair.repair_id, { status: 'In Progress' });
      setNotice(`${repair.vehicle_number}: repair started`);
      load();
    } catch (err) {
      setError(err.message);
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
      setNotice(`${completing.vehicle_number}: repair completed`);
      setCompleting(null);
      load();
    } catch (err) {
      setError(err.message);
      setCompleting(null);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader text="Loading your work queue…" />;

  const openMaintenance = maintenance.filter((m) => m.status !== 'Completed' && m.status !== 'Cancelled');
  const openRepairs = repairs.filter((r) => r.status === 'Open' || r.status === 'In Progress');

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">My work queue</h1>
          <p className="page-subtitle">
            Jobs assigned to <strong>{user?.name}</strong> — matched on the technician field
          </p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-secondary" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      <Banner type="error" message={error} onClose={() => setError('')} />
      <Banner type="success" message={notice} onClose={() => setNotice('')} />

      <div className="grid grid-stats mb-3">
        <StatCard label="Open maintenance" value={openMaintenance.length} hint="Scheduled or in progress" icon="🔧" tone="amber" />
        <StatCard label="Open repairs" value={openRepairs.length} hint="Awaiting completion" icon="🛠" tone="red" />
        <StatCard label="Maintenance records" value={maintenance.length} hint="Assigned to you, all time" icon="📋" tone="blue" />
        <StatCard label="Repair records" value={repairs.length} hint="Assigned to you, all time" icon="📁" tone="purple" />
      </div>

      {maintenance.length === 0 && repairs.length === 0 && (
        <div className="card">
          <div className="table-empty">
            <span className="table-empty-icon" aria-hidden="true">📌</span>
            Nothing is assigned to you yet.
            <div className="muted small mt-3">
              Work appears here when the technician field on a maintenance or repair
              record matches your account name exactly.
            </div>
          </div>
        </div>
      )}

      {/* ---------------- maintenance queue ---------------- */}
      {maintenance.length > 0 && (
        <div className="card mb-3">
          <div className="card-header">
            <div className="card-title">Assigned maintenance</div>
            <div className="card-header-actions">
              <span className="muted small">{openMaintenance.length} open</span>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vehicle</th><th>Service</th><th>Date</th>
                  <th className="num">Odometer</th><th className="num">Cost</th>
                  <th>Status</th><th className="num">Update</th>
                </tr>
              </thead>
              <tbody>
                {maintenance.map((m) => (
                  <tr key={m.maintenance_id}>
                    <td>
                      <Link to={`/vehicles/${m.vehicle_id}`} className="strong">{m.vehicle_number}</Link>
                      <div className="muted small">{m.manufacturer} {m.model}</div>
                    </td>
                    <td>
                      <div>{m.maintenance_type}</div>
                      {m.description && <div className="muted small">{m.description}</div>}
                    </td>
                    <td className="nowrap">{formatDate(m.service_date)}</td>
                    <td className="num">{formatNumber(m.odometer_reading)} km</td>
                    <td className="num">{formatCurrency(m.service_cost)}</td>
                    <td><span className={`badge ${statusBadge(m.status)}`}>{m.status}</span></td>
                    <td className="num">
                      <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
                        {m.status === 'Scheduled' && (
                          <button
                            type="button" className="btn btn-secondary btn-sm"
                            onClick={() => updateMaintenanceStatus(m, 'In Progress')}
                          >
                            Start
                          </button>
                        )}
                        {['Scheduled', 'In Progress'].includes(m.status) && (
                          <button
                            type="button" className="btn btn-success btn-sm"
                            onClick={() => updateMaintenanceStatus(m, 'Completed')}
                          >
                            ✓ Complete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- repair queue ---------------- */}
      {repairs.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Assigned repairs</div>
            <div className="card-header-actions">
              <span className="muted small">{openRepairs.length} open</span>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vehicle</th><th>Problem</th><th>Parts</th>
                  <th className="num">Cost</th><th className="num">Downtime</th>
                  <th>Status</th><th className="num">Update</th>
                </tr>
              </thead>
              <tbody>
                {repairs.map((r) => (
                  <tr key={r.repair_id}>
                    <td>
                      <Link to={`/vehicles/${r.vehicle_id}`} className="strong">{r.vehicle_number}</Link>
                      <div className="muted small nowrap">{formatDate(r.repair_date)}</div>
                    </td>
                    <td style={{ maxWidth: 240 }}>
                      <div className="small strong">{r.problem_description}</div>
                      {r.repair_description && <div className="muted small">{r.repair_description}</div>}
                    </td>
                    <td className="small">{r.parts_replaced || '—'}</td>
                    <td className="num">{formatCurrency(r.repair_cost)}</td>
                    <td className="num">{formatNumber(r.downtime_hours, 1)} h</td>
                    <td><span className={`badge ${statusBadge(r.status)}`}>{r.status}</span></td>
                    <td className="num">
                      <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
                        {r.status === 'Open' && (
                          <button
                            type="button" className="btn btn-secondary btn-sm"
                            onClick={() => startRepair(r)}
                          >
                            Start
                          </button>
                        )}
                        {['Open', 'In Progress'].includes(r.status) && (
                          <button
                            type="button" className="btn btn-success btn-sm"
                            onClick={() => setCompleting({ ...r })}
                          >
                            ✓ Complete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- completion form ---------------- */}
      <Modal
        open={Boolean(completing)}
        onClose={() => setCompleting(null)}
        title={`Complete repair — ${completing?.vehicle_number || ''}`}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setCompleting(null)}>Cancel</button>
            <button type="submit" form="mywork-complete" className="btn btn-success" disabled={saving}>
              {saving ? 'Saving…' : 'Complete repair'}
            </button>
          </>
        }
      >
        {completing && (
          <form id="mywork-complete" onSubmit={submitCompletion}>
            <p className="muted small mb-3"><strong>Problem:</strong> {completing.problem_description}</p>
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
          </form>
        )}
      </Modal>
    </>
  );
}
