import { useState } from 'react';

import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Banner from '../components/Banner';
import { formatDate, initials } from '../utils/format';

const ROLE_ABILITIES = {
  Admin: [
    'Manage all vehicles, drivers and users',
    'Delete any record',
    'Manage service schedules and repair records',
    'View fleet analytics and every report',
    'Generate forecasts and alerts',
  ],
  'Fleet Manager': [
    'View the whole fleet',
    'Add trips, maintenance and repair records',
    'View maintenance forecasts and availability',
    'Generate reports',
  ],
  Technician: [
    'View maintenance assigned to you',
    'Update service status and completion',
    'Add repair details and parts replaced',
    'View the fleet and forecasts',
  ],
};

export default function Settings() {
  const { user, updateUser } = useAuth();

  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [profileError, setProfileError] = useState('');
  const [profileNotice, setProfileNotice] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwNotice, setPwNotice] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const handleProfileChange = (e) =>
    setProfile((p) => ({ ...p, [e.target.name]: e.target.value }));

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileNotice('');

    if (profile.name.trim().length < 2) {
      setProfileError('Name must be at least 2 characters');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(profile.email)) {
      setProfileError('Enter a valid email address');
      return;
    }

    setSavingProfile(true);
    try {
      const updated = await authApi.updateProfile({
        name: profile.name.trim(),
        email: profile.email.trim(),
        phone: profile.phone || null,
      });
      updateUser(updated);
      setProfileNotice('Profile updated');
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePwChange = (e) => setPw((p) => ({ ...p, [e.target.name]: e.target.value }));

  const savePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwNotice('');

    if (!pw.current_password) {
      setPwError('Enter your current password');
      return;
    }
    if (pw.new_password.length < 6) {
      setPwError('New password must be at least 6 characters');
      return;
    }
    if (pw.new_password !== pw.confirm) {
      setPwError('New passwords do not match');
      return;
    }

    setSavingPw(true);
    try {
      await authApi.changePassword({
        current_password: pw.current_password,
        new_password: pw.new_password,
      });
      setPwNotice('Password changed successfully');
      setPw({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      setPwError(err.message);
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile &amp; settings</h1>
          <p className="page-subtitle">Manage your account details and password</p>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <div className="flex-row" style={{ gap: 16 }}>
            <div className="avatar" style={{ width: 58, height: 58, fontSize: 21 }}>
              {initials(user?.name)}
            </div>
            <div>
              <h2 style={{ fontSize: 18 }}>{user?.name}</h2>
              <div className="muted">{user?.email}</div>
              <div className="flex-row mt-3">
                <span className="badge badge-purple">{user?.role}</span>
                <span className="muted small">Member since {formatDate(user?.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-2 mb-3">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Account details</div>
              <div className="card-subtitle">Update your name, email and phone</div>
            </div>
          </div>
          <div className="card-body">
            <Banner type="error" message={profileError} onClose={() => setProfileError('')} />
            <Banner type="success" message={profileNotice} onClose={() => setProfileNotice('')} />

            <form onSubmit={saveProfile}>
              <div className="form-group mb-3">
                <label className="form-label">Full name</label>
                <input
                  name="name" className="form-control"
                  value={profile.name} onChange={handleProfileChange}
                />
              </div>
              <div className="form-group mb-3">
                <label className="form-label">Email address</label>
                <input
                  name="email" type="email" className="form-control"
                  value={profile.email} onChange={handleProfileChange}
                />
              </div>
              <div className="form-group mb-3">
                <label className="form-label">Phone</label>
                <input
                  name="phone" className="form-control"
                  value={profile.phone} onChange={handleProfileChange}
                  placeholder="+91-98765 43210"
                />
              </div>
              <div className="form-group mb-3">
                <label className="form-label">Role</label>
                <input className="form-control" value={user?.role || ''} disabled />
                <span className="form-hint">Only an administrator can change your role.</span>
              </div>

              <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                {savingProfile ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Change password</div>
              <div className="card-subtitle">You will stay signed in on this device</div>
            </div>
          </div>
          <div className="card-body">
            <Banner type="error" message={pwError} onClose={() => setPwError('')} />
            <Banner type="success" message={pwNotice} onClose={() => setPwNotice('')} />

            <form onSubmit={savePassword}>
              <div className="form-group mb-3">
                <label className="form-label">Current password</label>
                <input
                  name="current_password" type="password" className="form-control"
                  value={pw.current_password} onChange={handlePwChange}
                  autoComplete="current-password"
                />
              </div>
              <div className="form-group mb-3">
                <label className="form-label">New password</label>
                <input
                  name="new_password" type="password" className="form-control"
                  value={pw.new_password} onChange={handlePwChange}
                  placeholder="At least 6 characters" autoComplete="new-password"
                />
              </div>
              <div className="form-group mb-3">
                <label className="form-label">Confirm new password</label>
                <input
                  name="confirm" type="password" className="form-control"
                  value={pw.confirm} onChange={handlePwChange}
                  autoComplete="new-password"
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={savingPw}>
                {savingPw ? 'Updating…' : 'Change password'}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">What your role can do</div>
            <div className="card-subtitle">
              Permissions are enforced by the API, not just hidden in the interface
            </div>
          </div>
        </div>
        <div className="card-body">
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 2 }}>
            {(ROLE_ABILITIES[user?.role] || []).map((ability) => (
              <li key={ability}>{ability}</li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
