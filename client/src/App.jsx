import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useParams, Outlet } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { ShieldAlert } from 'lucide-react'
import { ProtectedRoute, RoleRoute, GuestRoute, FeatureRoute } from './components/ProtectedRoute'
import DashboardLayout from './components/layout/DashboardLayout'
import Spinner from './components/ui/Spinner'
import Login from './pages/Login'
import Signup from './pages/Signup'
import PlatformConsole from './pages/PlatformConsole'
import BusinessSettings from './pages/BusinessSettings'
import Dashboard from './pages/Dashboard'
import WashQueue from './pages/WashQueue'
import FloorQueue from './pages/FloorQueue'
import Checkout from './pages/Checkout'
import MembershipPlans from './pages/MembershipPlans'
import Tickets from './pages/Tickets'
import Bookings from './pages/Bookings'
import Customers from './pages/Customers'
import Vehicles from './pages/Vehicles'
import Services from './pages/Services'
import Staff from './pages/Staff'
import HR from './pages/HR'
import Inventory from './pages/Inventory'
import Expenses from './pages/Expenses'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import NotFound from './pages/NotFound'
import Landing from './pages/Landing'
import PublicBooking from './pages/PublicBooking'
import { useAuth } from './context/AuthContext'
import { getErrorMessage, setActiveTenantSlug } from './api/client'

/**
 * Gate for a business workspace. The URL names the business (`/t/<slug>`);
 * this makes sure the session is actually pointed at it before any data loads.
 */
const TenantGate = () => {
  const { slug } = useParams()
  const { tenant, tenants, switchTenant, refreshTenant, isPlatformAdmin } = useAuth()
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!slug || tenant?.slug === slug) return
    let cancelled = false

    const enter = async () => {
      try {
        if (isPlatformAdmin) {
          // The operator can look inside any business without belonging to it.
          setActiveTenantSlug(slug)
          await refreshTenant()
          return
        }
        const known = tenants.find((t) => t.slug === slug)
        if (!known) {
          if (!cancelled) setError('You do not have access to this business.')
          return
        }
        await switchTenant(slug)
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err))
      }
    }

    enter()
    return () => {
      cancelled = true
    }
  }, [slug, tenant?.slug, tenants, switchTenant, refreshTenant, isPlatformAdmin])

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
        <div className="card max-w-md p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <ShieldAlert size={26} />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">Business unavailable</h2>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
          <a href="/" className="btn-primary mt-5 inline-flex">
            Go to my workspace
          </a>
        </div>
      </div>
    )
  }

  if (!tenant || tenant.slug !== slug) return <Spinner full />

  return <Outlet />
}

/** The root URL sends people to the business they are working in. */
const RootRedirect = () => {
  const { isAuthenticated, loading, tenant } = useAuth()
  if (loading) return <Spinner full />
  if (isAuthenticated && tenant?.slug) return <Navigate to={`/t/${tenant.slug}`} replace />
  if (isAuthenticated) return <Navigate to="/platform" replace />
  return <Landing />
}

function App() {
  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { fontSize: 14 } }} />
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/platform" element={<PlatformConsole />} />

          <Route path="/t/:slug" element={<TenantGate />}>
            <Route element={<DashboardLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="floor" element={<FloorQueue />} />
              <Route path="checkout" element={<Checkout />} />
              <Route path="tickets" element={<Tickets />} />
              <Route path="bookings" element={<Bookings />} />
              <Route path="customers" element={<Customers />} />
              <Route path="vehicles" element={<Vehicles />} />
              <Route path="services" element={<Services />} />
              <Route path="settings" element={<Settings />} />

              <Route element={<RoleRoute roles={['manager']} />}>
                <Route path="wash-queue" element={<WashQueue />} />
                <Route path="staff" element={<Staff />} />
                <Route path="expenses" element={<Expenses />} />
              </Route>

              <Route element={<RoleRoute roles={['manager']} />}>
                <Route element={<FeatureRoute feature="memberships" />}>
                  <Route path="memberships" element={<MembershipPlans />} />
                </Route>
                <Route element={<FeatureRoute feature="hr" />}>
                  <Route path="hr" element={<HR />} />
                </Route>
                <Route element={<FeatureRoute feature="inventory" />}>
                  <Route path="inventory" element={<Inventory />} />
                </Route>
                <Route element={<FeatureRoute feature="reports" />}>
                  <Route path="reports" element={<Reports />} />
                </Route>
              </Route>

              <Route element={<RoleRoute roles={['admin']} />}>
                <Route path="business" element={<BusinessSettings />} />
              </Route>
            </Route>
          </Route>
        </Route>

        <Route path="/book/:slug" element={<PublicBooking />} />
        <Route path="/book/:slug/confirm/:id" element={<PublicBooking />} />
        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}

export default App
