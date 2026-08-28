import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { ProtectedRoute, RoleRoute, GuestRoute } from './components/ProtectedRoute'
import DashboardLayout from './components/layout/DashboardLayout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import WashQueue from './pages/WashQueue'
import FloorQueue from './pages/FloorQueue'
import Checkout from './pages/Checkout'
import MembershipPlans from './pages/MembershipPlans'
import Concierge from './pages/Concierge'
import Tickets from './pages/Tickets'
import Bookings from './pages/Bookings'
import Customers from './pages/Customers'
import Vehicles from './pages/Vehicles'
import Services from './pages/Services'
import Staff from './pages/Staff'
import HR from './pages/HR'
import Inventory from './pages/Inventory'
import Expenses from './pages/Expenses'
import Finance from './pages/Finance'
import Reports from './pages/Reports'
import Simulations from './pages/Simulations'
import Settings from './pages/Settings'
import NotFound from './pages/NotFound'

function App() {
  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { fontSize: 14 } }} />
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/floor" element={<FloorQueue />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/vehicles" element={<Vehicles />} />
            <Route path="/services" element={<Services />} />
            <Route path="/settings" element={<Settings />} />

            <Route element={<RoleRoute roles={['admin', 'manager']} />}>
              <Route path="/wash-queue" element={<WashQueue />} />
              <Route path="/memberships" element={<MembershipPlans />} />
              <Route path="/concierge" element={<Concierge />} />
              <Route path="/staff" element={<Staff />} />
              <Route path="/hr" element={<HR />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/simulations" element={<Simulations />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}

export default App
