import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Droplets, Loader2, Check, Store } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { saasApi } from '../api/resources'
import { getErrorMessage } from '../api/client'

const FEATURE_LABELS = {
  washFloor: 'Wash floor',
  bookings: 'Bookings',
  reports: 'Reports',
  memberships: 'Memberships',
  inventory: 'Inventory',
  hr: 'HR & shifts',
  whatsapp: 'WhatsAlerts',
}

const Signup = () => {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [plans, setPlans] = useState([])
  const [form, setForm] = useState({
    businessName: '',
    name: '',
    email: '',
    password: '',
    phone: '',
    plan: 'starter',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    saasApi
      .plans()
      .then(setPlans)
      .catch(() => setPlans([]))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const session = await signup(form)
      toast.success('Your business is ready!')
      navigate(`/t/${session.tenant?.slug || ''}`)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 px-4 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8 flex flex-col items-center text-white">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 shadow-lg backdrop-blur">
            <Droplets size={28} />
          </div>
          <h1 className="mt-3 text-2xl font-bold">Start running your car wash</h1>
          <p className="text-sm text-brand-100">
            One account for your business — add branches, invite your team, take bookings.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          {/* Plans */}
          <div className="space-y-3">
            {plans.map((p) => {
              const selected = form.plan === p.code
              return (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => setForm({ ...form, plan: p.code })}
                  className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                    selected
                      ? 'border-white bg-white/95 shadow-lg'
                      : 'border-white/30 bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold ${selected ? 'text-slate-900' : 'text-white'}`}>
                      {p.name}
                    </span>
                    <span className={`text-sm ${selected ? 'text-slate-600' : 'text-brand-100'}`}>
                      ${p.priceMonthly}/mo
                    </span>
                  </div>
                  <div className="mt-1 text-xs opacity-80">
                    {p.maxLocations} branch{p.maxLocations === 1 ? '' : 'es'} · {p.maxStaff} staff ·{' '}
                    {p.maxCustomers.toLocaleString()} customers
                  </div>
                  <ul className={`mt-3 space-y-1 text-xs ${selected ? 'text-slate-600' : 'text-brand-50'}`}>
                    {Object.entries(p.features || {})
                      .filter(([, on]) => on)
                      .map(([key]) => (
                        <li key={key} className="flex items-center gap-1.5">
                          <Check size={12} /> {FEATURE_LABELS[key] || key}
                        </li>
                      ))}
                  </ul>
                </button>
              )
            })}
          </div>

          {/* Signup form */}
          <div className="card p-6 sm:p-7">
            <h2 className="text-lg font-semibold text-slate-900">Create your business</h2>
            <p className="mt-1 text-sm text-slate-500">
              You become the owner. Everything else — price list, bays, branch — is set up for you.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="label">Business name</label>
                <input
                  required
                  className="input"
                  placeholder="Sparkle Wash"
                  value={form.businessName}
                  onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Your name</label>
                <input
                  required
                  className="input"
                  placeholder="Alex Owner"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Email address</label>
                <input
                  type="email"
                  required
                  className="input"
                  placeholder="you@yourwash.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <input
                  className="input"
                  placeholder="555-0100"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  className="input"
                  placeholder="At least 6 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Store size={16} />}
                Create my business
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-brand-600 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Signup
