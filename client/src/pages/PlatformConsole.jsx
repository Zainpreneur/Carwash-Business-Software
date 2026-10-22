import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Droplets, Building2, Users, MapPin, Loader2, Plus, ExternalLink, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import { platformApi } from '../api/resources'
import { getErrorMessage, setActiveTenantSlug } from '../api/client'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/ui/Modal'
import Badge from '../components/ui/Badge'
import StatCard from '../components/ui/StatCard'
import Spinner from '../components/ui/Spinner'

const STATUS_OPTIONS = ['trial', 'active', 'suspended']

const PlatformConsole = () => {
  const { isPlatformAdmin } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [tenants, setTenants] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    businessName: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
    plan: 'starter',
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([platformApi.stats(), platformApi.tenants(), platformApi.plans()])
      .then(([s, t, p]) => {
        setStats(s)
        setTenants(t)
        setPlans(p)
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (isPlatformAdmin) load()
    else setLoading(false)
  }, [isPlatformAdmin, load])

  const updateTenant = async (id, patch) => {
    try {
      await platformApi.updateTenant(id, patch)
      toast.success('Business updated')
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const createTenant = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await platformApi.createTenant(form)
      toast.success('Business created')
      setModalOpen(false)
      setForm({ businessName: '', ownerName: '', ownerEmail: '', ownerPassword: '', plan: 'starter' })
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const inspect = async (tenant) => {
    setActiveTenantSlug(tenant.slug)
    navigate(`/t/${tenant.slug}`)
  }

  if (!isPlatformAdmin) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
        <div className="card max-w-md p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <ShieldAlert size={26} />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">Platform administrators only</h2>
          <p className="mt-2 text-sm text-slate-500">
            This console manages every business on the platform. Sign in with a platform
            administrator account to use it.
          </p>
          <a href="/login" className="btn-primary mt-5 inline-flex">
            Back to sign in
          </a>
        </div>
      </div>
    )
  }

  if (loading) return <Spinner full />

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Droplets size={18} />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-slate-900">Platform Console</p>
              <p className="text-[11px] leading-tight text-slate-500">SudsFlow SaaS operator</p>
            </div>
          </div>
          <div className="flex gap-2">
            <a href="/login" className="btn-secondary">
              Sign in as a business
            </a>
            <button onClick={() => setModalOpen(true)} className="btn-primary">
              <Plus size={15} /> New business
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Building2} label="Businesses" value={stats?.tenants ?? 0} />
          <StatCard icon={Users} label="Team members" value={stats?.members ?? 0} />
          <StatCard icon={MapPin} label="Branches" value={stats?.locations ?? 0} />
          <StatCard
            icon={Droplets}
            label="Logins"
            value={stats?.users ?? 0}
            sub={Object.entries(stats?.byPlan || {})
              .map(([plan, count]) => `${plan}: ${count}`)
              .join(' · ')}
          />
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Businesses</h2>
            <p className="text-xs text-slate-500">
              Change a plan, suspend an account, or look inside a business.
            </p>
          </div>
          <div className="table-wrap rounded-none border-0">
            <table>
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Branches</th>
                  <th>Members</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t._id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-8 w-8 shrink-0 rounded-lg"
                          style={{ backgroundColor: t.brandColor || '#0284c7' }}
                        />
                        <div>
                          <p className="font-medium text-slate-800">{t.name}</p>
                          <p className="text-xs text-slate-400">/t/{t.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <select
                        className="input w-32 py-1.5"
                        value={t.plan}
                        onChange={(e) => updateTenant(t._id, { plan: e.target.value })}
                      >
                        {plans.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="input w-32 py-1.5"
                        value={t.status}
                        onChange={(e) => updateTenant(t._id, { status: e.target.value })}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{t.locations}</td>
                    <td>{t.members}</td>
                    <td className="text-xs text-slate-500">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <button onClick={() => inspect(t)} className="btn-ghost px-2 py-1" title="Open">
                        <ExternalLink size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-slate-900">Plan catalogue</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {plans.map((p) => (
              <div key={p.code} className="rounded-xl border border-slate-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-800">{p.name}</p>
                  <p className="text-sm font-semibold text-slate-900">${p.priceMonthly}/mo</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {p.maxLocations} branches · {p.maxStaff} staff · {p.maxCustomers?.toLocaleString()}{' '}
                  customers
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {Object.entries(p.features || {})
                    .filter(([, on]) => on)
                    .map(([key]) => (
                      <Badge key={key} color="slate">
                        {key}
                      </Badge>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Provision a business"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="platform-tenant-form" disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={15} className="animate-spin" /> : 'Create business'}
            </button>
          </>
        }
      >
        <form id="platform-tenant-form" onSubmit={createTenant} className="space-y-4">
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
            <label className="label">Owner name</label>
            <input
              className="input"
              placeholder="Alex Owner"
              value={form.ownerName}
              onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Owner email</label>
            <input
              required
              type="email"
              className="input"
              placeholder="owner@yourwash.com"
              value={form.ownerEmail}
              onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Owner password</label>
            <input
              className="input"
              placeholder="welcome123"
              value={form.ownerPassword}
              onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Plan</label>
            <select
              className="input"
              value={form.plan}
              onChange={(e) => setForm({ ...form, plan: e.target.value })}
            >
              {plans.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default PlatformConsole
