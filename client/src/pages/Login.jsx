import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Droplets, Eye, EyeOff, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../api/client'

const DEMO_ACCOUNTS = [
  { label: 'owner', email: 'owner@carwash.com', password: 'admin123', business: 'Sparkle Wash' },
  { label: 'manager', email: 'manager@carwash.com', password: 'manager123', business: 'Sparkle Wash' },
  { label: 'staff', email: 'john@carwash.com', password: 'staff123', business: 'Sparkle Wash' },
  { label: 'business 2', email: 'owner@autoshine.com', password: 'admin123', business: 'AutoShine' },
]

const Login = () => {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const session = await login(form)
      toast.success('Welcome back!')
      if (session.platformRole === 'platform_admin') {
        navigate('/platform')
        return
      }
      navigate(`/t/${session.tenant?.slug || ''}`)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = (account) => {
    setForm({ email: account.email, password: account.password })
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-white">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 shadow-lg backdrop-blur">
            <Droplets size={28} />
          </div>
          <h1 className="mt-3 text-2xl font-bold">SudsFlow</h1>
          <p className="text-sm text-brand-100">Car Wash Business Management</p>
        </div>

        <div className="card p-6 sm:p-7">
          <h2 className="text-lg font-semibold text-slate-900">Sign in to your account</h2>
          <p className="mt-1 text-sm text-slate-500">Enter your credentials to access the dashboard.</p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                required
                className="input"
                placeholder="you@carwash.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="input pr-10"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Sign in'}
            </button>
          </form>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="mb-2 text-center text-xs text-slate-400">Quick demo login</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  onClick={() => fillDemo(account)}
                  className="btn-secondary py-1.5 text-xs"
                  type="button"
                >
                  {account.label}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-5 text-center text-sm text-slate-500">
            Don&apos;t have a business yet?{' '}
            <Link to="/signup" className="font-medium text-brand-600 hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
