import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTenant } from '../context/TenantContext'
import Spinner from './ui/Spinner'
import { Lock } from 'lucide-react'

export const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <Spinner full />
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}

/**
 * Role gate. The list states the *minimum* privilege, so `roles={['manager']}`
 * also admits admins and owners — exactly like the server-side check.
 */
export const RoleRoute = ({ roles }) => {
  const { role, isPlatformAdmin } = useAuth()
  const { can } = useTenant()

  if (isPlatformAdmin) return <Outlet />
  const allowed = roles.some((minimum) => can(minimum))
  if (!allowed) return <Navigate to="/" replace />
  return <Outlet />
}

/**
 * Plan gate: a feature the business's plan does not include is replaced with an
 * upgrade prompt instead of a broken screen.
 */
export const FeatureRoute = ({ feature, children }) => {
  const { hasFeature, plan, tenant } = useTenant()

  if (hasFeature(feature)) return children ?? <Outlet />

  return (
    <div className="mx-auto max-w-lg">
      <div className="card p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Lock size={24} />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">
          Not part of the {plan?.name || 'current'} plan
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          {tenant?.name} is on the {plan?.name || 'current'} plan. Upgrade to unlock this feature for
          every branch.
        </p>
        <a href="/platform" className="btn-primary mt-5 inline-flex">
          Contact us to upgrade
        </a>
      </div>
    </div>
  )
}

export const GuestRoute = () => {
  const { isAuthenticated, loading, tenant } = useAuth()
  if (loading) return <Spinner full />
  if (isAuthenticated && tenant?.slug) return <Navigate to={`/t/${tenant.slug}`} replace />
  if (isAuthenticated) return <Navigate to="/platform" replace />
  return <Outlet />
}
