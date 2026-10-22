import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

/**
 * Which business (tenant) and which branch (location) the app is currently
 * pointed at. Both are sent as headers on every request — the server resolves
 * the tenant from `X-Tenant-Slug` and narrows to a location from `X-Location-Id`.
 */
export const TENANT_KEY = 'cw_tenant'
export const LOCATION_KEY = 'cw_location'

export const getActiveTenantSlug = () => localStorage.getItem(TENANT_KEY) || ''

export const setActiveTenantSlug = (slug) => {
  if (slug) localStorage.setItem(TENANT_KEY, slug)
  else localStorage.removeItem(TENANT_KEY)
}

export const getActiveLocationId = () => localStorage.getItem(LOCATION_KEY) || ''

export const setActiveLocationId = (id) => {
  if (id) localStorage.setItem(LOCATION_KEY, id)
  else localStorage.removeItem(LOCATION_KEY)
}

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('cw_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  const slug = getActiveTenantSlug()
  if (slug) {
    config.headers['X-Tenant-Slug'] = slug
  }

  const locationId = getActiveLocationId()
  if (locationId) {
    config.headers['X-Location-Id'] = locationId
  }

  return config
})

apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('cw_token')
      localStorage.removeItem('cw_user')
      localStorage.removeItem('cw_session')
      localStorage.removeItem(TENANT_KEY)
      localStorage.removeItem(LOCATION_KEY)
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Something went wrong'

export default apiClient
