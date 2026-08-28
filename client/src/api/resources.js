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

export const washPackagesApi = makeResource('/wash-packages')
export const serviceBaysApi = makeResource('/service-bays')

export const membershipPlansApi = makeResource('/membership-plans')
export const membershipSubscriptionsApi = {
  list: (params) => apiClient.get('/membership-subscriptions', { params }).then((r) => r.data),
  create: (data) => apiClient.post('/membership-subscriptions', data).then((r) => r.data),
  pause: (id, pausedUntil) => apiClient.patch(`/membership-subscriptions/${id}/pause`, { pausedUntil }).then((r) => r.data),
  resume: (id) => apiClient.patch(`/membership-subscriptions/${id}/resume`).then((r) => r.data),
  markPaid: (id) => apiClient.patch(`/membership-subscriptions/${id}/mark-paid`).then((r) => r.data),
  cancel: (id) => apiClient.patch(`/membership-subscriptions/${id}/cancel`).then((r) => r.data),
}

export const integrationsApi = {
  status: () => apiClient.get('/integrations/status').then((r) => r.data),
}

export const conciergeApi = {
  conversations: () => apiClient.get('/concierge/conversations').then((r) => r.data),
  simulate: (fromPhone, text) => apiClient.post('/concierge/simulate', { fromPhone, text }).then((r) => r.data),
}

export const ledgerApi = {
  accounts: () => apiClient.get('/ledger/accounts').then((r) => r.data),
  entries: (params) => apiClient.get('/ledger/entries', { params }).then((r) => r.data),
  pnl: (params) => apiClient.get('/ledger/pnl', { params }).then((r) => r.data),
}

export const hrApi = {
  employees: {
    list: () => apiClient.get('/hr/employees').then((r) => r.data),
    get: (id) => apiClient.get(`/hr/employees/${id}`).then((r) => r.data),
    create: (data) => apiClient.post('/hr/employees', data).then((r) => r.data),
    update: (id, data) => apiClient.put(`/hr/employees/${id}`, data).then((r) => r.data),
    remove: (id) => apiClient.delete(`/hr/employees/${id}`).then((r) => r.data),
  },
  shifts: {
    list: (params) => apiClient.get('/hr/shifts', { params }).then((r) => r.data),
    create: (data) => apiClient.post('/hr/shifts', data).then((r) => r.data),
    update: (id, data) => apiClient.put(`/hr/shifts/${id}`, data).then((r) => r.data),
    remove: (id) => apiClient.delete(`/hr/shifts/${id}`).then((r) => r.data),
    clockIn: (id) => apiClient.patch(`/hr/shifts/${id}/clock-in`).then((r) => r.data),
    clockOut: (id) => apiClient.patch(`/hr/shifts/${id}/clock-out`).then((r) => r.data),
  },
  leaveRequests: {
    list: (params) => apiClient.get('/hr/leave-requests', { params }).then((r) => r.data),
    create: (data) => apiClient.post('/hr/leave-requests', data).then((r) => r.data),
    decide: (id, status) => apiClient.patch(`/hr/leave-requests/${id}/decision`, { status }).then((r) => r.data),
  },
  payrollRuns: {
    list: () => apiClient.get('/hr/payroll-runs').then((r) => r.data),
    get: (id) => apiClient.get(`/hr/payroll-runs/${id}`).then((r) => r.data),
    create: (data) => apiClient.post('/hr/payroll-runs', data).then((r) => r.data),
  },
}

export const inventoryApi = {
  supplies: {
    list: () => apiClient.get('/inventory/supplies').then((r) => r.data),
    create: (data) => apiClient.post('/inventory/supplies', data).then((r) => r.data),
    update: (id, data) => apiClient.put(`/inventory/supplies/${id}`, data).then((r) => r.data),
    remove: (id) => apiClient.delete(`/inventory/supplies/${id}`).then((r) => r.data),
  },
  adjustments: {
    list: () => apiClient.get('/inventory/adjustments').then((r) => r.data),
    create: (data) => apiClient.post('/inventory/adjustments', data).then((r) => r.data),
  },
  purchaseOrders: {
    list: () => apiClient.get('/inventory/purchase-orders').then((r) => r.data),
    get: (id) => apiClient.get(`/inventory/purchase-orders/${id}`).then((r) => r.data),
    create: (data) => apiClient.post('/inventory/purchase-orders', data).then((r) => r.data),
    approve: (id) => apiClient.patch(`/inventory/purchase-orders/${id}/approve`).then((r) => r.data),
    receive: (id, receivedLines) => apiClient.patch(`/inventory/purchase-orders/${id}/receive`, { receivedLines }).then((r) => r.data),
    close: (id) => apiClient.patch(`/inventory/purchase-orders/${id}/close`).then((r) => r.data),
  },
  forecast: {
    preview: () => apiClient.get('/inventory/forecast').then((r) => r.data),
    run: () => apiClient.post('/inventory/forecast/run').then((r) => r.data),
  },
}

export const simulationApi = {
  bayThroughput: () => apiClient.get('/simulations/bay-throughput').then((r) => r.data),
  demandForecast: () => apiClient.get('/simulations/demand-forecast').then((r) => r.data),
  staffingCapacity: () => apiClient.get('/simulations/staffing-capacity').then((r) => r.data),
  membershipEconomics: () => apiClient.get('/simulations/membership-economics').then((r) => r.data),
  cashFlowForecast: (weeks) => apiClient.get('/simulations/cash-flow-forecast', { params: { weeks } }).then((r) => r.data),
  pricingScenario: (data) => apiClient.post('/simulations/pricing-scenario', data).then((r) => r.data),
}

export const agentOpsApi = {
  orchestratorSnapshot: () => apiClient.get('/agent-ops/orchestrator-snapshot').then((r) => r.data),
  askStrategyAdvisor: (question) => apiClient.post('/agent-ops/strategy-advisor/ask', { question }).then((r) => r.data),
  strategyAdvisorHistory: () => apiClient.get('/agent-ops/strategy-advisor/history').then((r) => r.data),
  systemHealthReport: () => apiClient.get('/agent-ops/system-health-report').then((r) => r.data),
}

export const growthApi = {
  segmentSummary: () => apiClient.get('/growth/segments/summary').then((r) => r.data),
  segmentedCustomers: (segment) => apiClient.get('/growth/segments/customers', { params: { segment } }).then((r) => r.data),
  fleetInquiries: {
    list: () => apiClient.get('/growth/fleet-inquiries').then((r) => r.data),
    create: (data) => apiClient.post('/growth/fleet-inquiries', data).then((r) => r.data),
    updateStatus: (id, status) => apiClient.patch(`/growth/fleet-inquiries/${id}/status`, { status }).then((r) => r.data),
  },
  reviews: {
    list: () => apiClient.get('/growth/reviews').then((r) => r.data),
    create: (data) => apiClient.post('/growth/reviews', data).then((r) => r.data),
  },
}

export const ticketsApi = {
  list: (params) => apiClient.get('/tickets', { params }).then((r) => r.data),
  get: (id) => apiClient.get(`/tickets/${id}`).then((r) => r.data),
  create: (data) => apiClient.post('/tickets', data).then((r) => r.data),
  updateStatus: (id, status) => apiClient.patch(`/tickets/${id}/status`, { status }).then((r) => r.data),
  assign: (id, assignedTo) => apiClient.patch(`/tickets/${id}/assign`, { assignedTo }).then((r) => r.data),
  addComment: (id, body) => apiClient.post(`/tickets/${id}/comments`, { body }).then((r) => r.data),
}

export const washOrdersApi = {
  ...makeResource('/wash-orders'),
  assignBay: (id, bayId) => apiClient.patch(`/wash-orders/${id}/assign-bay`, bayId ? { bayId } : {}).then((r) => r.data),
  startWash: (id) => apiClient.patch(`/wash-orders/${id}/start-wash`).then((r) => r.data),
  completeWash: (id) => apiClient.patch(`/wash-orders/${id}/complete-wash`).then((r) => r.data),
  qualityCheck: (id, result) => apiClient.patch(`/wash-orders/${id}/qc`, { result }).then((r) => r.data),
  checkout: (id, paymentMethod) => apiClient.patch(`/wash-orders/${id}/checkout`, { paymentMethod }).then((r) => r.data),
  cancel: (id) => apiClient.patch(`/wash-orders/${id}/cancel`).then((r) => r.data),
  checkoutStats: () => apiClient.get('/wash-orders/checkout-stats').then((r) => r.data),
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
