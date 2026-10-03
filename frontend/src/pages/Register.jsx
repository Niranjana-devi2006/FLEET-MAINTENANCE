import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Banner from '../components/Banner';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '', email: '', phone: '', role: 'Fleet Manager',
    password: '', confirm: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const validate = () => {
    if (form.name.trim().length < 2) return 'Enter your full name';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return 'Enter a valid email address';
    if (form.password.length < 6) return 'Password must be at least 6 characters';
    if (form.password !== form.confirm) return 'Passwords do not match';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        role: form.role,
        password: form.password,
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-brand-panel">
        <div className="auth-brand-logo">
          <div className="sidebar-brand-mark" style={{ width: 42, height: 42, fontSize: 20 }}>⬢</div>
          <div className="auth-brand-title">FleetCare</div>
        </div>
        <h2 style={{ fontSize: 25, fontWeight: 600 }}>Join your fleet operations team.</h2>
        <p className="auth-brand-lead">
          Create an account to track vehicles, log trips and servicing, and see which
          vehicles are heading for maintenance next.
        </p>
        <p className="auth-brand-lead" style={{ fontSize: 13 }}>
          Administrator accounts are created from within the app by an existing
          administrator, so they are not offered here.
        </p>
      </div>

      <div className="auth-form-panel">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h1 className="auth-form-title">Create account</h1>
          <p className="auth-form-sub">It takes less than a minute.</p>

          <Banner type="error" message={error} onClose={() => setError('')} />

          <div className="form-group">
            <label className="form-label" htmlFor="name">Full name<span className="req">*</span></label>
            <input
              id="name" name="name" className="form-control" value={form.name}
              onChange={handleChange} placeholder="Priya Sharma" required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email address<span className="req">*</span></label>
            <input
              id="email" name="email" type="email" className="form-control"
              value={form.email} onChange={handleChange} placeholder="you@fleet.com" required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="phone">Phone</label>
            <input
              id="phone" name="phone" className="form-control" value={form.phone}
              onChange={handleChange} placeholder="+91-98765 43210"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="role">Role<span className="req">*</span></label>
            <select
              id="role" name="role" className="form-control"
              value={form.role} onChange={handleChange}
            >
              <option value="Fleet Manager">Fleet Manager</option>
              <option value="Technician">Technician</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password<span className="req">*</span></label>
            <input
              id="password" name="password" type="password" className="form-control"
              value={form.password} onChange={handleChange}
              placeholder="At least 6 characters" required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirm">Confirm password<span className="req">*</span></label>
            <input
              id="confirm" name="confirm" type="password" className="form-control"
              value={form.confirm} onChange={handleChange} required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? <><span className="spinner sm" /> Creating…</> : 'Create account'}
          </button>

          <p className="auth-footer-text">
            Already registered? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
