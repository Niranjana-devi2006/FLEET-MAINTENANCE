import { NavLink } from 'react-router-dom';
import { useAuth, ROLES } from '../context/AuthContext';

/**
 * Navigation is filtered by role: each entry declares which roles may see it.
 * This mirrors the authorisation enforced by the backend.
 */
const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: '▤', roles: null },
      { to: '/alerts', label: 'Alerts', icon: '🔔', roles: null, badge: 'alerts' },
    ],
  },
  {
    title: 'Fleet',
    items: [
      { to: '/vehicles', label: 'Vehicles', icon: '🚚', roles: null },
      { to: '/availability', label: 'Availability', icon: '◍', roles: null },
      { to: '/drivers', label: 'Drivers', icon: '👤', roles: [ROLES.ADMIN, ROLES.MANAGER] },
      { to: '/trips', label: 'Trips', icon: '🗺', roles: [ROLES.ADMIN, ROLES.MANAGER] },
    ],
  },
  {
    title: 'Workshop',
    items: [
      { to: '/maintenance', label: 'Maintenance', icon: '🔧', roles: null },
      { to: '/repairs', label: 'Repairs', icon: '🛠', roles: null },
      { to: '/my-work', label: 'My Work Queue', icon: '📌', roles: [ROLES.TECHNICIAN] },
    ],
  },
  {
    title: 'Insights',
    items: [
      { to: '/forecast', label: 'Forecast', icon: '📈', roles: null },
      { to: '/reports', label: 'Reports', icon: '📊', roles: [ROLES.ADMIN, ROLES.MANAGER] },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/users', label: 'Users', icon: '👥', roles: [ROLES.ADMIN] },
      { to: '/settings', label: 'Settings', icon: '⚙', roles: null },
    ],
  },
];

export default function Sidebar({ open, onClose, alertCount = 0 }) {
  const { user } = useAuth();

  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.roles || item.roles.includes(user?.role)),
  })).filter((section) => section.items.length > 0);

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark" aria-hidden="true">⬢</div>
          <div>
            <span className="sidebar-brand-text">FleetCare</span>
            <span className="sidebar-brand-sub">Maintenance Forecast</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {visibleSections.map((section) => (
            <div key={section.title}>
              <div className="sidebar-section">{section.title}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={onClose}
                >
                  <span className="nav-item-icon" aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.badge === 'alerts' && alertCount > 0 && (
                    <span className="nav-item-badge">{alertCount > 99 ? '99+' : alertCount}</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          Signed in as <strong style={{ color: '#cbd5e1' }}>{user?.role}</strong>
        </div>
      </aside>
    </>
  );
}
