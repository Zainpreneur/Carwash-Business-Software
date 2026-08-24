import apiClient from './client'

// Generic CRUD factory to avoid repeating boilerplate per-resource.
const makeResource = (base) => ({
  list: (params) => apiClient.get(base, { params }).then((r) => r.data),
  get: (id) => apiClient.get(`${base}/${id}`).then((r) => r.data),
  create: (data) => apiClient.post(base, data).then((r) => r.data),
  update: (id, data) => apiClient.put(`${base}/${id}`, data).then((r) => r.data),
  remove: (id) => apiClient.delete(`${base}/${id}`).then((r) => r.data),
})

export const authApi = {
  login: (data) => apiClient.post('/auth/login', data).then((r) => r.data),
  register: (data) => apiClient.post('/auth/register', data).then((r) => r.data),
  me: () => apiClient.get('/auth/me').then((r) => r.data),
}

export const customersApi = makeResource('/customers')
export const vehiclesApi = {
  ...makeResource('/vehicles'),
  lookupPlate: (plate) => apiClient.get(`/vehicles/plate/${encodeURIComponent(plate)}`).then((r) => r.data),
}
export const servicesApi = makeResource('/services')
export const usersApi = makeResource('/users')
export const expensesApi = {
  ...makeResource('/expenses'),
}

export const notificationsApi = {
  list: () => apiClient.get('/notifications').then((r) => r.data),
  unreadCount: () => apiClient.get('/notifications/unread-count').then((r) => r.data),
  markRead: (id) => apiClient.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => apiClient.patch('/notifications/read-all').then((r) => r.data),
}

export const bookingsApi = {
  ...makeResource('/bookings'),
  updateStatus: (id, status) => apiClient.patch(`/bookings/${id}/status`, { status }).then((r) => r.data),
  updatePayment: (id, data) => apiClient.patch(`/bookings/${id}/payment`, data).then((r) => r.data),
}

export const dashboardApi = {
  summary: () => apiClient.get('/dashboard/summary').then((r) => r.data),
  revenueChart: (days) => apiClient.get('/dashboard/revenue-chart', { params: { days } }).then((r) => r.data),
  serviceBreakdown: (days) =>
    apiClient.get('/dashboard/service-breakdown', { params: { days } }).then((r) => r.data),
  statusBreakdown: () => apiClient.get('/dashboard/status-breakdown').then((r) => r.data),
  upcomingBookings: () => apiClient.get('/dashboard/upcoming-bookings').then((r) => r.data),
  insights: () => apiClient.get('/dashboard/insights').then((r) => r.data),
}
