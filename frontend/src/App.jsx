import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { AuthProvider, useAuth, ROLES } from './context/AuthContext';
import { alertApi } from './services/api';

import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Vehicles from './pages/Vehicles';
import VehicleDetails from './pages/VehicleDetails';
import Availability from './pages/Availability';
import Drivers from './pages/Drivers';
import Trips from './pages/Trips';
import Maintenance from './pages/Maintenance';
import Repairs from './pages/Repairs';
import MyWork from './pages/MyWork';
import Forecast from './pages/Forecast';
import Alerts from './pages/Alerts';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Settings from './pages/Settings';

/** Page titles keyed by route prefix, shown in the top bar. */
const PAGE_META = {
  '/dashboard': ['Dashboard', 'Fleet health at a glance'],
  '/vehicles': ['Vehicles', 'Manage the fleet register'],
  '/availability': ['Vehicle Availability', 'Who is free, on the road, or in the workshop'],
  '/drivers': ['Drivers', 'Driver records and licence status'],
  '/trips': ['Trips', 'Assignments and journey history'],
  '/maintenance': ['Maintenance', 'Scheduled and completed servicing'],
  '/repairs': ['Repairs', 'Breakdowns, parts and downtime'],
  '/my-work': ['My Work Queue', 'Maintenance and repairs assigned to you'],
  '/forecast': ['Maintenance Forecast', 'Predicted servicing from usage history'],
  '/alerts': ['Alerts', 'Conditions that need attention'],
  '/reports': ['Reports', 'Costs, utilisation and history'],
  '/users': ['User Management', 'Accounts and roles'],
  '/settings': ['Settings', 'Your profile and password'],
};

function resolveMeta(pathname) {
  const key = Object.keys(PAGE_META).find(
    (k) => pathname === k || pathname.startsWith(`${k}/`)
  );
  return key ? PAGE_META[key] : ['FleetCare', ''];
}

/** Authenticated application shell: sidebar + top bar + routed page. */
function AppLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const location = useLocation();
  const [title, subtitle] = resolveMeta(location.pathname);

  const refreshAlertCount = useCallback(() => {
    alertApi
      .list({ status: 'Unread', limit: 1 })
      .then((res) => setAlertCount(res.meta?.unread ?? 0))
      .catch(() => {});
  }, []);

  // Refresh the badge on navigation and on a slow poll.
  useEffect(() => {
    refreshAlertCount();
  }, [location.pathname, refreshAlertCount]);

  useEffect(() => {
    const id = setInterval(refreshAlertCount, 60000);
    return () => clearInterval(id);
  }, [refreshAlertCount]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setSidebarOpen(false), [location.pathname]);

  return (
    <div className="app-shell">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        alertCount={alertCount}
      />
      <div className="main-area">
        <Navbar
          title={title}
          subtitle={subtitle}
          alertCount={alertCount}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />
        <main className="page">{children}</main>
      </div>
    </div>
  );
}

/** Wraps a page in the auth gate plus the shell. */
function Private({ element, roles }) {
  return (
    <ProtectedRoute roles={roles}>
      <AppLayout>{element}</AppLayout>
    </ProtectedRoute>
  );
}

/** Keeps signed-in users away from the login/register screens. */
function PublicOnly({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
}

function AppRoutes() {
  const { ADMIN, MANAGER, TECHNICIAN } = ROLES;

  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />

      <Route path="/dashboard" element={<Private element={<Dashboard />} />} />
      <Route path="/vehicles" element={<Private element={<Vehicles />} />} />
      <Route path="/vehicles/:id" element={<Private element={<VehicleDetails />} />} />
      <Route path="/availability" element={<Private element={<Availability />} />} />
      <Route path="/drivers" element={<Private element={<Drivers />} roles={[ADMIN, MANAGER]} />} />
      <Route path="/trips" element={<Private element={<Trips />} roles={[ADMIN, MANAGER]} />} />
      <Route path="/maintenance" element={<Private element={<Maintenance />} />} />
      <Route path="/repairs" element={<Private element={<Repairs />} />} />
      <Route path="/my-work" element={<Private element={<MyWork />} roles={[TECHNICIAN, ADMIN]} />} />
      <Route path="/forecast" element={<Private element={<Forecast />} />} />
      <Route path="/alerts" element={<Private element={<Alerts />} />} />
      <Route path="/reports" element={<Private element={<Reports />} roles={[ADMIN, MANAGER]} />} />
      <Route path="/users" element={<Private element={<Users />} roles={[ADMIN]} />} />
      <Route path="/settings" element={<Private element={<Settings />} />} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
