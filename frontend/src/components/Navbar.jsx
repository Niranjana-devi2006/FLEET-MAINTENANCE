import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { initials } from '../utils/format';

/** Top bar: page title, alert bell, and the user menu. */
export default function Navbar({ title, subtitle, onToggleSidebar, alertCount = 0 }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const onClickAway = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="topbar">
      <button
        type="button" className="hamburger"
        onClick={onToggleSidebar} aria-label="Toggle navigation"
      >
        ☰
      </button>

      <div>
        <div className="topbar-title">{title}</div>
        {subtitle && <div className="topbar-sub">{subtitle}</div>}
      </div>

      <div className="topbar-spacer" />

      <Link to="/alerts" className="icon-btn" title="Alerts" aria-label="Alerts">
        🔔
        {alertCount > 0 && <span className="icon-btn-dot">{alertCount > 99 ? '99+' : alertCount}</span>}
      </Link>

      <div className="user-chip" style={{ position: 'relative' }} ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <div className="avatar">{initials(user?.name)}</div>
          <div style={{ textAlign: 'left' }}>
            <div className="user-chip-name">{user?.name}</div>
            <div className="user-chip-role">{user?.role}</div>
          </div>
        </button>

        {menuOpen && (
          <div
            role="menu"
            style={{
              position: 'absolute', top: 'calc(100% + 10px)', right: 0,
              background: '#fff', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)',
              minWidth: 210, padding: 6, zIndex: 60,
            }}
          >
            <div style={{ padding: '9px 11px', borderBottom: '1px solid var(--border)', marginBottom: 5 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{user?.name}</div>
              <div className="muted small">{user?.email}</div>
            </div>
            <Link
              to="/settings" role="menuitem"
              onClick={() => setMenuOpen(false)}
              style={{ display: 'block', padding: '8px 11px', borderRadius: 6, color: 'var(--text)', fontSize: 13.5 }}
            >
              ⚙ Profile &amp; Settings
            </Link>
            <button
              type="button" role="menuitem" onClick={handleLogout}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 11px', borderRadius: 6, border: 'none',
                background: 'none', cursor: 'pointer',
                color: 'var(--red-600)', fontSize: 13.5, fontFamily: 'inherit',
              }}
            >
              ⏻ Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
