import { Link } from 'react-router-dom';
import { formatDateTime, statusBadge } from '../utils/format';

/** One alert row, used on the dashboard and the alerts page. */
export default function AlertCard({ alert, onMarkRead, onResolve, onDelete, compact = false }) {
  const tone = String(alert.priority || 'low').toLowerCase();

  return (
    <div className={`alert-card ${alert.status === 'Unread' ? 'unread' : ''}`}>
      <div className={`alert-bar ${tone}`} />

      <div className="alert-body">
        <div className="alert-type">
          {alert.alert_type}
          <span className={`badge ${statusBadge(alert.priority)}`} style={{ marginLeft: 8 }}>
            {alert.priority}
          </span>
        </div>
        <div className="alert-message">{alert.alert_message}</div>

        {!compact && (
          <div className="alert-meta">
            <span>{formatDateTime(alert.alert_date)}</span>
            {alert.vehicle_number && (
              <Link to={`/vehicles/${alert.vehicle_id}`}>{alert.vehicle_number}</Link>
            )}
            <span className={`badge ${statusBadge(alert.status)}`}>{alert.status}</span>
          </div>
        )}
      </div>

      {!compact && (
        <div className="alert-actions">
          {alert.status === 'Unread' && onMarkRead && (
            <button
              type="button" className="btn btn-secondary btn-sm"
              onClick={() => onMarkRead(alert.alert_id)} title="Mark as read"
            >
              ✓
            </button>
          )}
          {alert.status !== 'Resolved' && onResolve && (
            <button
              type="button" className="btn btn-success btn-sm"
              onClick={() => onResolve(alert.alert_id)} title="Resolve"
            >
              Resolve
            </button>
          )}
          {onDelete && (
            <button
              type="button" className="btn btn-danger btn-sm"
              onClick={() => onDelete(alert.alert_id)} title="Delete"
            >
              🗑
            </button>
          )}
        </div>
      )}
    </div>
  );
}
