import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { applyBrand } from '../lib/branding'
import { getActiveLocationId, setActiveLocationId } from '../api/client'

/**
 * Everything about the *business* the app is currently showing: its plan, the
 * features that plan unlocks, its branches, and the white-label branding.
 */

// Roles inside a business, ordered by privilege.
const ROLE_RANK = { staff: 1, manager: 2, admin: 3, owner: 4 }

export const roleAtLeast = (role, minimum) => (ROLE_RANK[role] || 0) >= (ROLE_RANK[minimum] || 99)

const TenantContext = createContext(null)

export const TenantProvider = ({ children }) => {
  const { tenant, role, tenants, isPlatformAdmin } = useAuth()
  const [locationId, setLocationId] = useState(() => getActiveLocationId())

  // White-label: repaint the app with the business's colour.
  useEffect(() => {
    if (tenant?.brandColor) applyBrand(tenant.brandColor)
  }, [tenant?.brandColor])

  const features = tenant?.features || {}
  const plan = tenant?.plan || null
  const locations = tenant?.locations || []

  const hasFeature = useCallback(
    (feature) => {
      if (!feature) return true
      return !!features[feature]
    },
    [features]
  )

  const can = useCallback(
    (minimum) => {
      if (isPlatformAdmin) return true
      return roleAtLeast(role, minimum)
    },
    [role, isPlatformAdmin]
  )

  /** Build a link that stays inside the current business. */
  const tenantPath = useCallback(
    (path = '/') => {
      const slug = tenant?.slug
      if (!slug) return path
      const suffix = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`
      return `/t/${slug}${suffix}`
    },
    [tenant?.slug]
  )

  const changeLocation = useCallback((id) => {
    setActiveLocationId(id || '')
    setLocationId(id || '')
  }, [])

  const value = useMemo(
    () => ({
      tenant,
      tenants,
      plan,
      features,
      locations,
      locationId,
      setLocationId: changeLocation,
      role,
      can,
      hasFeature,
      tenantPath,
      isPlatformAdmin,
    }),
    [tenant, tenants, plan, features, locations, locationId, changeLocation, role, can, hasFeature, tenantPath, isPlatformAdmin]
  )

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export const useTenant = () => {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error('useTenant must be used within TenantProvider')
  return ctx
}
