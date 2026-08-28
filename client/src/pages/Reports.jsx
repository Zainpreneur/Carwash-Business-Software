import { useEffect, useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { dashboardApi, analyticsApi } from '../api/resources'
import { getErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import { BarChart3, Gauge, Settings2 } from 'lucide-react'

const COLORS = { pending: '#f59e0b', confirmed: '#0284c7', 'in-progress': '#7c3aed', completed: '#16a34a', cancelled: '#e11d48' }
const currency = (n) => `$${Number(n || 0).toFixed(2)}`

const ranges = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
]

const scoreTone = (score) => {
  if (score === null) return 'text-slate-400'
  if (score >= 70) return 'text-emerald-600'
  if (score >= 40) return 'text-amber-600'
  return 'text-rose-600'
}

const formatRaw = (c) => {
  if (c.raw === null || c.raw === undefined) return 'No data yet'
  if (c.unit === 'rate') return `${(c.raw * 100).toFixed(1)}%`
  if (c.unit === 'stars') return `${c.raw.toFixed(1)} ★`
  if (c.unit === 'count') return `${c.raw >= 0 ? '+' : ''}${c.raw} (${c.detail.newThisMonth} new − ${c.detail.cancelledThisMonth} cancelled, this month)`
  return c.raw
}

const HealthScore = () => {
  const { user } = useAuth()
  const [health, setHealth] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    analyticsApi.healthScore().then(setHealth).catch((err) => toast.error(getErrorMessage(err)))
  }, [])

  useEffect(load, [load])

  const openEdit = () => {
    setForm({
      membershipPenetration: health.weights.membershipPenetration,
      bayUtilization: health.weights.bayUtilization,
      netMembershipGrowth: health.weights.netMembershipGrowth,
      avgReviewRating: health.weights.avgReviewRating,
      equipmentUptime: health.weights.equipmentUptime,
    })
    setModalOpen(true)
  }

  const weightSum = form ? Object.values(form).reduce((a, b) => a + Number(b || 0), 0) : 0

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await analyticsApi.updateWeights(Object.fromEntries(Object.entries(form).map(([k, v]) => [k, Number(v)])))
      toast.success('Weights updated')
      setModalOpen(false)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (!health) return null

  return (
    <div className="card p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge size={16} className="text-brand-500" />
          <h3 className="text-sm font-semibold text-slate-800">Business Health Score</h3>
        </div>
        {user?.role === 'admin' && (
          <button className="btn-secondary py-1 text-xs" onClick={openEdit}>
            <Settings2 size={13} /> Edit weights
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[auto,1fr]">
        <div className="flex flex-col items-center justify-center rounded-xl bg-slate-50 px-8 py-4">
          <p className={`text-4xl font-bold ${scoreTone(health.score)}`}>{health.score ?? '—'}</p>
          <p className="text-xs text-slate-400">out of 100</p>
        </div>
        <div className="space-y-2">
          {health.components.map((c) => (
            <div key={c.key} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-600">{c.label} <span className="text-xs text-slate-400">(weight {(c.weight * 100).toFixed(0)}%)</span></span>
              <span className="text-right text-xs text-slate-500">{formatRaw(c)}{c.score !== null && <span className={`ml-2 font-semibold ${scoreTone(c.score)}`}>{c.score}</span>}</span>
            </div>
          ))}
        </div>
      </div>
      {health.excludedFromScore.length > 0 && (
        <p className="mt-3 text-xs text-slate-400">
          Excluded from the score (no data yet, weight redistributed): {health.excludedFromScore.join(', ')}.
        </p>
      )}
      <p className="mt-2 text-xs text-slate-400">Equipment uptime is a current-snapshot proxy (share of bays not down) — this app has no Asset/IoT downtime log to compute the spec's actual trailing-30-day figure from.</p>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Edit health score weights"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" form="weights-form" type="submit" disabled={saving || Math.abs(weightSum - 1) > 0.01}>
              {saving ? 'Saving…' : 'Save weights'}
            </button>
          </>
        }
      >
        {form && (
          <form id="weights-form" onSubmit={submit} className="space-y-3">
            {[
              ['membershipPenetration', 'Membership Penetration'],
              ['bayUtilization', 'Bay Utilization'],
              ['netMembershipGrowth', 'Net Membership Growth'],
              ['avgReviewRating', 'Avg Review Rating'],
              ['equipmentUptime', 'Equipment Uptime'],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <label className="text-sm text-slate-600">{label}</label>
                <input
                  type="number" min="0" max="1" step="0.01" className="input w-24 text-right"
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
            <p className={`text-xs ${Math.abs(weightSum - 1) > 0.01 ? 'text-rose-500' : 'text-slate-400'}`}>
              Sum: {weightSum.toFixed(2)} (must equal 1.00)
            </p>
          </form>
        )}
      </Modal>
    </div>
  )
}

const Reports = () => {
  const [days, setDays] = useState(30)
  const [chart, setChart] = useState([])
  const [statusBreakdown, setStatusBreakdown] = useState([])
  const [serviceBreakdown, setServiceBreakdown] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      dashboardApi.revenueChart(days),
      dashboardApi.statusBreakdown(),
      dashboardApi.serviceBreakdown(days),
    ])
      .then(([c, s, b]) => {
        setChart(c)
        setStatusBreakdown(s)
        setServiceBreakdown(b)
      })
      .finally(() => setLoading(false))
  }, [days])

  const totalRevenue = chart.reduce((sum, d) => sum + d.revenue, 0)
  const totalBookings = chart.reduce((sum, d) => sum + d.bookings, 0)

  return (
    <div className="space-y-5">
      <HealthScore />

      <div className="flex flex-wrap items-center gap-2">
        {ranges.map((r) => (
          <button
            key={r.value}
            onClick={() => setDays(r.value)}
            className={days === r.value ? 'btn-primary py-1.5 text-xs' : 'btn-secondary py-1.5 text-xs'}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner full />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <div className="card p-4">
              <p className="text-xs uppercase text-slate-500">Revenue</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{currency(totalRevenue)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs uppercase text-slate-500">Completed bookings</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{totalBookings}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs uppercase text-slate-500">Avg ticket</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{currency(totalBookings ? totalRevenue / totalBookings : 0)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs uppercase text-slate-500">Daily average</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{currency(totalRevenue / (days || 1))}</p>
            </div>
          </div>

          <div className="card p-4 sm:p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-800">Revenue by day</h3>
            <div className="h-72 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ left: -20, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                  <XAxis dataKey="date" tickFormatter={(d) => format(parseISO(d), 'MMM d')} fontSize={11} stroke="#94a3b8" interval={days > 30 ? 6 : 1} />
                  <YAxis fontSize={11} stroke="#94a3b8" />
                  <Tooltip formatter={(v) => currency(v)} labelFormatter={(d) => format(parseISO(d), 'MMM d, yyyy')} contentStyle={{ borderRadius: 10, fontSize: 13 }} />
                  <Bar dataKey="revenue" fill="#0284c7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card p-4 sm:p-5">
              <h3 className="mb-4 text-sm font-semibold text-slate-800">Bookings by status</h3>
              {statusBreakdown.length === 0 ? (
                <EmptyState icon={BarChart3} title="No bookings yet" />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusBreakdown} dataKey="count" nameKey="status" innerRadius={45} outerRadius={80} paddingAngle={2}>
                        {statusBreakdown.map((d, i) => (
                          <Cell key={i} fill={COLORS[d.status] || '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11, textTransform: 'capitalize' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="card p-4 sm:p-5">
              <h3 className="mb-4 text-sm font-semibold text-slate-800">Top services by revenue</h3>
              {serviceBreakdown.length === 0 ? (
                <EmptyState icon={BarChart3} title="No completed bookings" />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={serviceBreakdown} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                      <XAxis type="number" fontSize={11} stroke="#94a3b8" />
                      <YAxis type="category" dataKey="name" fontSize={11} stroke="#94a3b8" width={110} />
                      <Tooltip formatter={(v) => currency(v)} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                      <Bar dataKey="revenue" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default Reports
