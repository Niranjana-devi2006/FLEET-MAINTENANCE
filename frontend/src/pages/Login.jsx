import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Banner from '../components/Banner';

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@fleet.com', password: 'Admin@123' },
  { role: 'Fleet Manager', email: 'manager@fleet.com', password: 'Manager@123' },
  { role: 'Technician', email: 'tech@fleet.com', password: 'Tech@123' },
];

const FEATURES = [
  ['📈', 'Predictive servicing', 'Forecasts built from real trip and service history, not guesswork.'],
  ['🔔', 'Condition alerts', 'Overdue services, long downtime and expiring licences surface automatically.'],
  ['🛠', 'Workshop tracking', 'Repairs, parts and downtime linked to every vehicle.'],
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.email.trim() || !form.password) {
      setError('Enter both your email address and password');
      return;
    }

    setSubmitting(true);
    try {
      await login(form.email.trim(), form.password);
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const useDemo = (account) => {
    setForm({ email: account.email, password: account.password });
    setError('');
  };

  return (
    <div className="auth-shell">
      <div className="auth-brand-panel">
        <div className="auth-brand-logo">
          <div className="sidebar-brand-mark" style={{ width: 42, height: 42, fontSize: 20 }}>⬢</div>
          <div className="auth-brand-title">FleetCare</div>
        </div>

        <h2 style={{ fontSize: 25, fontWeight: 600 }}>
          Know what needs servicing<br />before it breaks down.
        </h2>
        <p className="auth-brand-lead">
          A maintenance forecast system for fleet operators — vehicles, drivers, trips,
          servicing and repairs in one place, with predicted service dates derived
          from how each vehicle is actually used.
        </p>

        <div className="auth-feature-list">
          {FEATURES.map(([icon, title, text]) => (
            <div className="auth-feature" key={title}>
              <div className="auth-feature-icon" aria-hidden="true">{icon}</div>
              <div>
                <div className="auth-feature-title">{title}</div>
                <div className="auth-feature-text">{text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="auth-form-panel">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h1 className="auth-form-title">Sign in</h1>
          <p className="auth-form-sub">Welcome back. Enter your details to continue.</p>

          <Banner type="error" message={error} onClose={() => setError('')} />

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email address</label>
            <input
              id="email" name="email" type="email" className="form-control"
              placeholder="you@fleet.com" value={form.email}
              onChange={handleChange} autoComplete="username" required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password" name="password" type="password" className="form-control"
              placeholder="••••••••" value={form.password}
              onChange={handleChange} autoComplete="current-password" required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? <><span className="spinner sm" /> Signing in…</> : 'Sign in'}
          </button>

          <p className="auth-footer-text">
            No account yet? <Link to="/register">Create one</Link>
          </p>

          <div className="demo-creds">
            <div className="demo-creds-title">Demo accounts — click to fill</div>
            {DEMO_ACCOUNTS.map((a) => (
              <div
                key={a.email} className="demo-cred-row"
                onClick={() => useDemo(a)} role="button" tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && useDemo(a)}
              >
                <span className="demo-cred-role">{a.role}</span>
                <span className="demo-cred-value">{a.email} / {a.password}</span>
              </div>
            ))}
          </div>
        </form>
      </div>
    </div>
  );
}
