import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { CalendarClock, DollarSign, Hourglass, Users, Wrench, Sparkles, Lightbulb } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { dashboardApi } from '../api/resources'
import StatCard from '../components/ui/StatCard'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'

const COLORS = ['#0284c7', '#7c3aed', '#f59e0b', '#16a34a', '#e11d48', '#0891b2', '#db2777', '#65a30d']

const currency = (n) => `$${Number(n || 0).toFixed(2)}`

const Dashboard = () => {
  const [summary, setSummary] = useState(null)
  const [chart, setChart] = useState([])
  const [breakdown, setBreakdown] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [insights, setInsights] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.all([
      dashboardApi.summary(),
      dashboardApi.revenueChart(14),
      dashboardApi.serviceBreakdown(30),
      dashboardApi.upcomingBookings(),
      dashboardApi.insights().catch(() => null),
    ])
      .then(([s, c, b, u, ins]) => {
        if (!mounted) return
        setSummary(s)
        setChart(c)
        setBreakdown(b)
        setUpcoming(u)
        setInsights(ins)
      })
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [])

  if (loading) return <Spinner full />

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {greeting} 👋
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Here's what's happening at your car wash today.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200">
          <span className="text-xs text-slate-500">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={DollarSign} label="Today's Revenue" value={currency(summary.todayRevenue)} sub={`${summary.todayCompletedCount} completed`} tone="green" />
        <StatCard icon={CalendarClock} label="Today's Bookings" value={summary.todayBookings} sub={`${summary.pendingBookings} pending`} tone="brand" />
        <StatCard icon={Hourglass} label="In Progress" value={summary.inProgressBookings} sub="Active right now" tone="amber" />
        <StatCard icon={Users} label="Total Customers" value={summary.totalCustomers} sub={`${summary.activeServices} active services`} tone="purple" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard icon={DollarSign} label="Month Revenue" value={currency(summary.monthRevenue)} tone="green" />
        <StatCard icon={Wrench} label="Month Expenses" value={currency(summary.monthExpenses)} tone="rose" />
        <StatCard icon={DollarSign} label="Month Profit" value={currency(summary.monthProfit)} tone={summary.monthProfit >= 0 ? 'brand' : 'rose'} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-4 sm:p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-800">Revenue — last 14 days</h3>
          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ left: -20, right: 10 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="date" tickFormatter={(d) => format(parseISO(d), 'MMM d')} fontSize={11} stroke="#94a3b8" />
                <YAxis fontSize={11} stroke="#94a3b8" />
                <Tooltip
                  formatter={(v) => [currency(v), 'Revenue']}
                  labelFormatter={(d) => format(parseISO(d), 'MMM d, yyyy')}
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#0284c7" strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4 sm:p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-800">Top services (30 days)</h3>
          {breakdown.length === 0 ? (
            <EmptyState icon={Wrench} title="No data yet" message="Completed bookings will appear here." />
          ) : (
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={breakdown} dataKey="revenue" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {breakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => currency(v)} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {insights && (
        <div className="card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={16} className="text-brand-500" />
            <h3 className="text-sm font-semibold text-slate-800">Business Advisor</h3>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-600">
              {insights.summary.completedThisMonth} completed this month · avg ${insights.summary.avgBookingValue}
            </span>
          </div>
          {insights.recommendations.length === 0 ? (
            <p className="text-sm text-slate-400">Everything looks healthy — no recommendations right now.</p>
          ) : (
            <ul className="space-y-2">
              {insights.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <Lightbulb size={14} className="mt-0.5 shrink-0 text-amber-500" />
                  {rec}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>Repeat customers: <b className="text-slate-700">{insights.summary.repeatCustomerRate}%</b></span>
            <span>Cancelled: <b className="text-slate-700">{insights.summary.statusBreakdown.cancelled || 0}</b></span>
            <span>Pending: <b className="text-slate-700">{insights.summary.statusBreakdown.pending || 0}</b></span>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 sm:px-5">
          <h3 className="text-sm font-semibold text-slate-800">Upcoming bookings</h3>
        </div>
        {upcoming.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No upcoming bookings" message="New bookings will show up here." />
        ) : (
          <div className="table-wrap border-0 shadow-none">
            <table>
              <thead>
                <tr>
                  <th>Booking #</th>
                  <th>Customer</th>
                  <th>Vehicle</th>
                  <th>Scheduled</th>
                  <th>Staff</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((b) => (
                  <tr key={b._id}>
                    <td className="font-medium text-slate-900">{b.bookingNumber}</td>
                    <td>{b.customer?.name}</td>
                    <td>{b.vehicle ? `${b.vehicle.make} ${b.vehicle.model}` : '—'}</td>
                    <td>{format(new Date(b.scheduledAt), 'MMM d, h:mm a')}</td>
                    <td>{b.assignedStaff?.name || '—'}</td>
                    <td>
                      <Badge status={b.status}>{b.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
