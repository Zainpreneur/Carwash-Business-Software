import { useEffect, useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Gauge, TrendingUp, Users2, Calculator, Wallet, AlertTriangle, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { simulationApi, membershipPlansApi } from '../api/resources'
import { getErrorMessage } from '../api/client'
import Spinner from '../components/ui/Spinner'
import Badge from '../components/ui/Badge'

// Simulation & Forecasting (02-intelligence/simulation.md) — deployment guide build-order
// step 8, the last step. Every number here is either read live off real data or a clearly
// labeled stated assumption — never a bare unlabeled point estimate, per the spec's own
// "Calibration and honesty" section. Not built: downtime-cost-simulator (needs an Asset/IoT
// entity this app doesn't have) and demand-forecast's weather-api overlay.
const currency = (n) => `$${Number(n || 0).toFixed(2)}`
const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const DataSourceBadge = ({ source }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${source === 'observed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
    <Info size={11} /> {source === 'observed' ? 'Observed data' : 'Industry-benchmark default'}
  </span>
)

const Simulations = () => {
  const [bayThroughput, setBayThroughput] = useState(null)
  const [demand, setDemand] = useState(null)
  const [staffing, setStaffing] = useState(null)
  const [economics, setEconomics] = useState(null)
  const [cashFlow, setCashFlow] = useState(null)
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)

  const [scenarioPlan, setScenarioPlan] = useState('')
  const [scenarioPct, setScenarioPct] = useState(10)
  const [scenarioElasticity, setScenarioElasticity] = useState(-0.3)
  const [scenarioResult, setScenarioResult] = useState(null)
  const [running, setRunning] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      simulationApi.bayThroughput(),
      simulationApi.demandForecast(),
      simulationApi.staffingCapacity(),
      simulationApi.membershipEconomics(),
      simulationApi.cashFlowForecast(4),
      membershipPlansApi.list(),
    ])
      .then(([bt, d, s, e, cf, p]) => {
        setBayThroughput(bt)
        setDemand(d)
        setStaffing(s)
        setEconomics(e)
        setCashFlow(cf)
        setPlans(p)
        if (p.length && !scenarioPlan) setScenarioPlan(p[0]._id)
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(load, [load])

  const runScenario = async () => {
    if (!scenarioPlan) return
    setRunning(true)
    try {
      const result = await simulationApi.pricingScenario({ planId: scenarioPlan, priceChangePercent: Number(scenarioPct), elasticity: Number(scenarioElasticity) })
      setScenarioResult(result)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setRunning(false)
    }
  }

  if (loading || !bayThroughput || !demand || !staffing || !economics || !cashFlow) return <Spinner full />

  const todayDow = new Date().getDay()
  const todayCurve = demand.weeklyCurve[todayDow].map((v, hour) => ({ hour: `${hour}:00`, vehicles: v }))
  const gapDays = [...new Set(staffing.gaps.map((g) => g.dayOfWeek))]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><Gauge size={15} /> Bay throughput</h3>
          </div>
          <div className="space-y-3">
            {bayThroughput.lanes.map((l) => (
              <div key={l.lane} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize text-slate-800">{l.lane.replace('-', ' ')} ({l.bayCount} bays)</span>
                  {l.structurallyUndersized ? <Badge color="red">Undersized at peak</Badge> : <Badge color="green">Sized OK</Badge>}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-500">
                  <div><p className="text-slate-400">Theoretical</p><p className="font-medium text-slate-700">{l.theoreticalCapacityPerHour}/hr</p></div>
                  <div><p className="text-slate-400">Effective (85%)</p><p className="font-medium text-slate-700">{l.effectiveCapacityPerHour}/hr</p></div>
                  <div><p className="text-slate-400">Peak demand</p><p className="font-medium text-slate-700">{l.peakDemand}/hr @ {l.peakHour}:00</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><TrendingUp size={15} /> Demand forecast — {DOW_LABELS[todayDow]}</h3>
            <DataSourceBadge source={demand.dataSource} />
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={todayCurve} margin={{ left: -20, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="hour" fontSize={10} stroke="#94a3b8" interval={2} />
                <YAxis fontSize={10} stroke="#94a3b8" />
                <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                <Bar dataKey="vehicles" fill="#0284c7" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {demand.note && <p className="mt-2 text-xs text-slate-400">{demand.note}</p>}
        </div>
      </div>

      <div className="card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><Users2 size={15} /> Staffing coverage gaps</h3>
          <DataSourceBadge source={staffing.demandDataSource} />
        </div>
        {staffing.gaps.length === 0 ? (
          <p className="text-sm text-slate-400">No coverage gaps against forecasted demand.</p>
        ) : (
          <p className="text-sm text-slate-600">
            <span className="flex items-center gap-1.5 font-medium text-amber-600"><AlertTriangle size={14} /> {staffing.gaps.length} hour-slots understaffed</span>
            <span className="mt-1 block text-xs text-slate-400">across {gapDays.length} day(s) of the week — based on demand vs. currently scheduled Shifts, at {staffing.assumptions.bayAttendantVehiclesPerHour}/hr per bay-attendant and {staffing.assumptions.washTechnicianVehiclesPerHour}/hr per wash-technician (stated assumptions).</span>
          </p>
        )}
      </div>

      <div className="card p-4 sm:p-5">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-800"><Calculator size={15} /> Membership economics</h3>
        <p className="mb-3 text-xs text-slate-500">Variable cost per wash: {currency(economics.variableCostPerWash)} (chemicals {currency(economics.assumptions.chemicalCostPerWash)} + water/energy {currency(economics.assumptions.waterEnergyCostPerWash)} + labor {currency(economics.laborCostPerWash)} — stated assumptions, editable in code).</p>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Plan</th><th>Members</th><th>Breakeven washes/mo</th><th>Avg washes/mo</th><th>Margin/mo</th><th>LTV</th><th></th></tr></thead>
            <tbody>
              {economics.tiers.map((t) => (
                <tr key={t.plan._id}>
                  <td className="font-medium text-slate-800">{t.plan.name}</td>
                  <td>{t.activeSubscriptionCount}</td>
                  <td>{t.breakevenWashesPerMonth}</td>
                  <td>{t.avgWashesPerMonth} <DataSourceBadge source={t.washesDataSource} /></td>
                  <td className={t.isLosingMoneyOnAverage ? 'text-rose-600' : 'text-emerald-600'}>{currency(t.contributionMarginPerMonth)}</td>
                  <td>{currency(t.ltv)}</td>
                  <td>{t.isLosingMoneyOnAverage && <Badge color="red">Losing money on average</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-4 sm:p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Pricing scenario</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Plan</label>
            <select className="input w-auto" value={scenarioPlan} onChange={(e) => setScenarioPlan(e.target.value)}>
              {plans.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Price change %</label>
            <input type="number" className="input w-24" value={scenarioPct} onChange={(e) => setScenarioPct(e.target.value)} />
          </div>
          <div>
            <label className="label">Elasticity</label>
            <input type="number" step="0.05" className="input w-24" value={scenarioElasticity} onChange={(e) => setScenarioElasticity(e.target.value)} />
          </div>
          <button className="btn-primary" disabled={running} onClick={runScenario}>Run scenario</button>
        </div>
        {scenarioResult && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3 text-center"><p className="text-xs text-slate-500">New price</p><p className="font-semibold text-slate-800">{currency(scenarioResult.newPrice)}</p></div>
            <div className="rounded-lg bg-slate-50 p-3 text-center"><p className="text-xs text-slate-500">Member impact</p><p className="font-semibold text-slate-800">{scenarioResult.memberImpactPercent}%</p></div>
            <div className="rounded-lg bg-slate-50 p-3 text-center"><p className="text-xs text-slate-500">Revenue delta</p><p className={`font-semibold ${scenarioResult.revenueDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{currency(scenarioResult.revenueDelta)}</p></div>
            <div className="rounded-lg bg-slate-50 p-3 text-center"><p className="text-xs text-slate-500">Margin delta</p><p className={`font-semibold ${scenarioResult.marginDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{currency(scenarioResult.marginDelta)}</p></div>
          </div>
        )}
      </div>

      <div className="card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><Wallet size={15} /> Cash flow forecast</h3>
          {cashFlow.anyNegativeWeek && <Badge color="red">Negative week ahead</Badge>}
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Week</th><th>Inflow</th><th>Outflow</th><th>Net</th><th>Cumulative</th></tr></thead>
            <tbody>
              {cashFlow.weeks.map((w) => (
                <tr key={w.week}>
                  <td>Week {w.week}</td>
                  <td className="text-emerald-600">{currency(w.inflow)}</td>
                  <td className="text-rose-600">{currency(w.outflow)}</td>
                  <td>{currency(w.net)}</td>
                  <td className={w.cumulativeNet < 0 ? 'font-medium text-rose-600' : 'font-medium text-slate-800'}>{currency(w.cumulativeNet)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-400">{cashFlow.note}</p>
      </div>
    </div>
  )
}

export default Simulations
