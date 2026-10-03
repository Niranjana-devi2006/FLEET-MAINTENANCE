import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loader from './Loader';

/**
 * Gate for authenticated routes.
 * Pass `roles` to additionally restrict a page to specific roles.
 */
export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) return <Loader text="Checking your session…" />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return (
      <div className="page">
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 44 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
            <h2 className="page-title">Access denied</h2>
            <p className="muted mt-3">
              This page is restricted to: {roles.join(', ')}.<br />
              You are signed in as <strong>{user.role}</strong>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
