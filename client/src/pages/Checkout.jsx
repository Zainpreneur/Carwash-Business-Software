import { useCallback, useEffect, useState } from 'react'
import { LogOut, DollarSign, CreditCard, Users2, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { washOrdersApi } from '../api/resources'
import { getErrorMessage } from '../api/client'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import StatCard from '../components/ui/StatCard'
import MembershipSignupModal from '../components/washqueue/MembershipSignupModal'

// Cashier home view (carwash-compile/01-foundation/dashboards.md): the checkout queue
// (ReadyForPickup orders), today's revenue split, and the membership-signup shortcut.

const currency = (n) => `$${Number(n || 0).toFixed(2)}`

const Checkout = () => {
  const [orders, setOrders] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [methods, setMethods] = useState({})
  const [busyId, setBusyId] = useState(null)
  const [signupOpen, setSignupOpen] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([washOrdersApi.list({ status: 'ready-for-pickup', limit: 50 }), washOrdersApi.checkoutStats()])
      .then(([orderRes, statsRes]) => {
        setOrders(orderRes.data)
        setStats(statsRes)
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  // Returning from a Stripe Checkout redirect (see MembershipSignupModal's success/cancel URLs).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const membership = params.get('membership')
    if (membership === 'success') toast.success('Membership signed up — welcome message sent!')
    else if (membership === 'cancelled') toast('Membership signup cancelled', { icon: 'ℹ️' })
    if (membership) window.history.replaceState({}, '', window.location.pathname)
  }, [])

  const confirmCheckout = async (o) => {
    setBusyId(o._id)
    try {
      await washOrdersApi.checkout(o._id, methods[o._id] || o.paymentMethod)
      toast.success(`${o.orderNumber} checked out`)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <Spinner full />

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button className="btn-secondary" onClick={() => setSignupOpen(true)}>
          <UserPlus size={16} /> New membership
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={DollarSign} label="Today's revenue" value={currency(stats?.totalRevenue)} tone="green" />
        <StatCard icon={LogOut} label="Checked out" value={stats?.checkedOutToday ?? 0} tone="brand" />
        <StatCard icon={CreditCard} label="Pay-per-wash" value={currency(stats?.split?.payPerWash)} tone="purple" />
        <StatCard icon={Users2} label="Membership" value={currency(stats?.split?.membership)} tone="amber" />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Ready for pickup</h3>
        {orders.length === 0 ? (
          <div className="card"><EmptyState icon={LogOut} title="Nothing waiting on checkout" /></div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {orders.map((o) => (
              <div key={o._id} className="card p-4">
                <p className="font-medium text-slate-900">{o.vehicle.make} {o.vehicle.model}</p>
                <p className="text-xs text-slate-500">{o.vehicle.plateNumber} · {o.customer?.name || 'Walk-in'} · {o.package.name}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-lg font-semibold text-slate-900">{currency(o.price)}</p>
                  <select
                    className="input w-auto py-1.5 text-xs"
                    value={methods[o._id] ?? o.paymentMethod}
                    onChange={(e) => setMethods({ ...methods, [o._id]: e.target.value })}
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="membership">Membership</option>
                    <option value="fleet-invoice">Fleet invoice</option>
                  </select>
                </div>
                <button
                  disabled={busyId === o._id}
                  onClick={() => confirmCheckout(o)}
                  className="btn-primary mt-3 w-full py-2"
                >
                  <LogOut size={15} /> Checkout
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <MembershipSignupModal open={signupOpen} onClose={() => setSignupOpen(false)} onSaved={() => { setSignupOpen(false); load() }} />
    </div>
  )
}

export default Checkout
