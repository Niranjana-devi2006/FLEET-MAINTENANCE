/**
 * Axios instance + a thin wrapper per API resource.
 *
 * Every backend response is { success, data, ... }; these helpers unwrap it so
 * components deal with plain data, and normalise errors into a thrown Error
 * carrying the server's message.
 */
import axios from 'axios';

const TOKEN_KEY = 'fleet_token';
const USER_KEY = 'fleet_user';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach the JWT to every outgoing request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Normalise errors; bounce to login when the token is rejected.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message =
      error.response?.data?.message ||
      (error.code === 'ERR_NETWORK'
        ? 'Cannot reach the server. Is the backend running on port 5000?'
        : error.message) ||
      'Unexpected error';

    if (status === 401 && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      window.location.href = '/login';
    }

    const wrapped = new Error(message);
    wrapped.status = status;
    wrapped.errors = error.response?.data?.errors;
    return Promise.reject(wrapped);
  }
);

/** Unwrap { success, data } -> data */
const unwrap = (res) => res.data.data;
/** Keep the full envelope when pagination/meta is needed. */
const envelope = (res) => res.data;

// --- auth -------------------------------------------------------------------
export const authApi = {
  login: (payload) => api.post('/auth/login', payload).then(unwrap),
  register: (payload) => api.post('/auth/register', payload).then(unwrap),
  profile: () => api.get('/auth/profile').then(unwrap),
  updateProfile: (payload) => api.put('/auth/profile', payload).then(unwrap),
  changePassword: (payload) => api.put('/auth/password', payload).then(unwrap),
};

// --- vehicles ---------------------------------------------------------------
export const vehicleApi = {
  list: (params) => api.get('/vehicles', { params }).then(envelope),
  listBasic: () => api.get('/vehicles', { params: { basic: 'true' } }).then(unwrap),
  get: (id) => api.get(`/vehicles/${id}`).then(unwrap),
  create: (payload) => api.post('/vehicles', payload).then(unwrap),
  update: (id, payload) => api.put(`/vehicles/${id}`, payload).then(unwrap),
  remove: (id) => api.delete(`/vehicles/${id}`).then(unwrap),
  options: () => api.get('/vehicles/meta/options').then(unwrap),
  availability: () => api.get('/vehicles/availability').then(unwrap),
};

// --- drivers ----------------------------------------------------------------
export const driverApi = {
  list: (params) => api.get('/drivers', { params }).then(envelope),
  listBasic: () => api.get('/drivers', { params: { basic: 'true' } }).then(unwrap),
  get: (id) => api.get(`/drivers/${id}`).then(unwrap),
  create: (payload) => api.post('/drivers', payload).then(unwrap),
  update: (id, payload) => api.put(`/drivers/${id}`, payload).then(unwrap),
  remove: (id) => api.delete(`/drivers/${id}`).then(unwrap),
  expiring: (days = 30) => api.get('/drivers/expiring/licenses', { params: { days } }).then(unwrap),
};

// --- trips ------------------------------------------------------------------
export const tripApi = {
  list: (params) => api.get('/trips', { params }).then(envelope),
  get: (id) => api.get(`/trips/${id}`).then(unwrap),
  create: (payload) => api.post('/trips', payload).then(unwrap),
  update: (id, payload) => api.put(`/trips/${id}`, payload).then(unwrap),
  remove: (id) => api.delete(`/trips/${id}`).then(unwrap),
};

// --- maintenance ------------------------------------------------------------
export const maintenanceApi = {
  list: (params) => api.get('/maintenance', { params }).then(envelope),
  get: (id) => api.get(`/maintenance/${id}`).then(unwrap),
  create: (payload) => api.post('/maintenance', payload).then(unwrap),
  update: (id, payload) => api.put(`/maintenance/${id}`, payload).then(unwrap),
  remove: (id) => api.delete(`/maintenance/${id}`).then(unwrap),
  upcoming: (days = 30) => api.get('/maintenance/upcoming/list', { params: { days } }).then(unwrap),
  assignedToMe: (params) => api.get('/maintenance/assigned/me', { params }).then(unwrap),
  serviceTypes: () => api.get('/maintenance/meta/service-types').then(unwrap),
};

// --- repairs ----------------------------------------------------------------
export const repairApi = {
  list: (params) => api.get('/repairs', { params }).then(envelope),
  get: (id) => api.get(`/repairs/${id}`).then(unwrap),
  create: (payload) => api.post('/repairs', payload).then(unwrap),
  update: (id, payload) => api.put(`/repairs/${id}`, payload).then(unwrap),
  complete: (id, payload) => api.put(`/repairs/${id}/complete`, payload).then(unwrap),
  remove: (id) => api.delete(`/repairs/${id}`).then(unwrap),
  open: () => api.get('/repairs/open/list').then(unwrap),
};

// --- forecast ---------------------------------------------------------------
export const forecastApi = {
  list: (params) => api.get('/forecast', { params }).then(envelope),
  byVehicle: (vehicleId) => api.get(`/forecast/${vehicleId}`).then(unwrap),
  generate: (payload = {}) => api.post('/forecast/generate', payload).then(unwrap),
};

// --- alerts -----------------------------------------------------------------
export const alertApi = {
  list: (params) => api.get('/alerts', { params }).then(envelope),
  markRead: (id) => api.put(`/alerts/${id}/read`).then(unwrap),
  resolve: (id) => api.put(`/alerts/${id}/resolve`).then(unwrap),
  markAllRead: () => api.put('/alerts/read-all').then(unwrap),
  remove: (id) => api.delete(`/alerts/${id}`).then(unwrap),
  generate: () => api.post('/alerts/generate').then(unwrap),
};

// --- dashboard --------------------------------------------------------------
export const dashboardApi = {
  stats: () => api.get('/dashboard/stats').then(unwrap),
  charts: (months = 12) => api.get('/dashboard/charts', { params: { months } }).then(unwrap),
  tables: () => api.get('/dashboard/tables').then(unwrap),
};

// --- users ------------------------------------------------------------------
export const userApi = {
  list: () => api.get('/users').then(unwrap),
  get: (id) => api.get(`/users/${id}`).then(unwrap),
  create: (payload) => api.post('/users', payload).then(unwrap),
  update: (id, payload) => api.put(`/users/${id}`, payload).then(unwrap),
  remove: (id) => api.delete(`/users/${id}`).then(unwrap),
};

// --- reports ----------------------------------------------------------------
export const reportApi = {
  run: (name, params) => api.get(`/reports/${name}`, { params }).then(envelope),
};

export { TOKEN_KEY, USER_KEY };
export default api;
