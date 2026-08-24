import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { dashboardApi } from '../api/resources'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import { BarChart3 } from 'lucide-react'

const COLORS = { pending: '#f59e0b', confirmed: '#0284c7', 'in-progress': '#7c3aed', completed: '#16a34a', cancelled: '#e11d48' }
const currency = (n) => `$${Number(n || 0).toFixed(2)}`

const ranges = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
]

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
