import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authApi, tenantApi } from '../api/resources'
import { setActiveLocationId, setActiveTenantSlug } from '../api/client'

/**
 * A login is a *platform* identity; a business is a *membership*. This context
 * therefore keeps three things apart:
 *
 *   user    — who is signed in (never carries a business role)
 *   tenants — every business that user belongs to
 *   tenant  — the business currently being worked in, with its plan + features
 */

const AuthContext = createContext(null)

const SESSION_KEY = 'cw_session'

const readStored = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** Flatten the API session shape into the profile the pages expect. */
const profileOf = (data) => {
  if (!data?.user) return null
  return {
    _id: data.user._id,
    name: data.user.name,
    email: data.user.email,
    phone: data.user.phone,
    avatarColor: data.user.avatarColor,
    active: data.user.active,
    platformRole: data.user.platformRole,
    role: data.role || null,
  }
}

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(() => readStored())
  const [loading, setLoading] = useState(true)

  const persist = useCallback((next) => {
    setSession(next)
    if (next) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(next))
      localStorage.setItem('cw_user', JSON.stringify(next.user))
      setActiveTenantSlug(next.tenant?.slug || '')
    } else {
      localStorage.removeItem(SESSION_KEY)
      localStorage.removeItem('cw_user')
      localStorage.removeItem('cw_token')
      setActiveTenantSlug('')
      setActiveLocationId('')
    }
  }, [])

  // Restore the session on boot: the stored tenant slug tells the API which
  // business the request is about, then /auth/me confirms everything.
  useEffect(() => {
    const token = localStorage.getItem('cw_token')
    if (!token) {
      setLoading(false)
      return
    }

    const stored = readStored()
    if (stored?.tenant?.slug) setActiveTenantSlug(stored.tenant.slug)

    const restore = async (allowStaleRetry) => {
      try {
        const data = await authApi.me()

        const next = {
          user: profileOf(data),
          tenant: data.tenant || null,
          tenants: data.tenants || [],
          role: data.role || null,
          platformRole: data.user?.platformRole || 'user',
        }

        // The stored slug wins when the account belongs to several businesses:
        // it is what the user was actually looking at.
        const storedSlug = stored?.tenant?.slug
        const match = storedSlug ? next.tenants.find((t) => t.slug === storedSlug) : null
        if (match && (!next.tenant || next.tenant.slug !== storedSlug)) {
          try {
            const sw = await authApi.switchTenant(storedSlug)
            persist({ ...next, tenant: sw.tenant, role: sw.role })
          } catch {
            persist(next)
          }
          return
        }

        persist(next)
      } catch (err) {
        // A stale business slug (deleted business, renamed link) must not lock
        // the user out — drop the slug and try once more without it.
        if (allowStaleRetry && err?.response?.status === 404) {
          setActiveTenantSlug('')
          restore(false)
          return
        }
        persist(null)
      } finally {
        setLoading(false)
      }
    }

    restore(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(
    async (credentials) => {
      const data = await authApi.login(credentials)
      localStorage.setItem('cw_token', data.token)
      const next = {
        user: profileOf(data),
        tenant: data.tenant || null,
        tenants: data.tenants || [],
        role: data.role || null,
        platformRole: data.user?.platformRole || 'user',
      }
      persist(next)
      return next
    },
    [persist]
  )

  /** Self-serve signup: creates the business, the owner and the starter setup. */
  const signup = useCallback(
    async (payload) => {
      const data = await authApi.signup(payload)
      localStorage.setItem('cw_token', data.token)
      const next = {
        user: profileOf(data),
        tenant: data.tenant || null,
        tenants: data.tenant ? [{ ...data.tenant, role: 'owner' }] : [],
        role: data.role || 'owner',
        platformRole: data.user?.platformRole || 'user',
      }
      persist(next)
      return next
    },
    [persist]
  )

  const switchTenant = useCallback(
    async (tenantSlug) => {
      const data = await authApi.switchTenant(tenantSlug)
      localStorage.setItem('cw_token', data.token)
      setActiveTenantSlug(data.tenant?.slug || tenantSlug)
      setSession((prev) => {
        if (!prev) return prev
        const user = { ...prev.user, role: data.role || prev.user?.role }
        localStorage.setItem('cw_user', JSON.stringify(user))
        return { ...prev, tenant: data.tenant, role: data.role, user }
      })
      return data
    },
    []
  )

  /** Patch the signed-in profile (name, phone, avatar colour). */
  const updateProfile = useCallback((patch) => {
    setSession((prev) => {
      if (!prev) return prev
      const user = { ...prev.user, ...patch }
      localStorage.setItem('cw_user', JSON.stringify(user))
      return { ...prev, user }
    })
  }, [])

  /** Re-read the active business (plan, features, branding, branches). */
  const refreshTenant = useCallback(async () => {
    const context = await tenantApi.current()
    setSession((prev) => ({ ...prev, tenant: context }))
    return context
  }, [])

  const logout = useCallback(() => {
    persist(null)
  }, [persist])

  const value = useMemo(
    () => ({
      user: session?.user || null,
      tenant: session?.tenant || null,
      tenants: session?.tenants || [],
      role: session?.role || session?.user?.role || null,
      platformRole: session?.platformRole || 'user',
      loading,
      login,
      signup,
      switchTenant,
      refreshTenant,
      updateProfile,
      logout,
      isAuthenticated: !!session?.user,
      isPlatformAdmin: session?.platformRole === 'platform_admin',
    }),
    [session, loading, login, signup, switchTenant, refreshTenant, updateProfile, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
