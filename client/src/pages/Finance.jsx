import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { Landmark, TrendingUp, TrendingDown, ScrollText } from 'lucide-react'
import toast from 'react-hot-toast'
import { ledgerApi } from '../api/resources'
import { getErrorMessage } from '../api/client'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'

// Financial View (05-finance/accounting.md) — a real double-entry ledger's P&L, chart of
// accounts, and journal, sized for a single-location business the same way the spec's own
// 21-account chart is. See ledgerService.js for what auto-posts and what (payroll, purchase
// orders, refunds) doesn't yet — this page only reports what's actually been posted.
const currency = (n) => `$${Number(n || 0).toFixed(2)}`

const monthStart = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
const today = () => new Date().toISOString().slice(0, 10)

const TYPE_LABEL = { asset: 'Assets', liability: 'Liabilities', equity: 'Equity', revenue: 'Revenue', expense: 'Expenses' }

const Finance = () => {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const [accounts, setAccounts] = useState([])
  const [entries, setEntries] = useState([])
  const [pnl, setPnl] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([ledgerApi.accounts(), ledgerApi.entries({ from, to, limit: 50 }), ledgerApi.pnl({ from, to })])
      .then(([acc, ent, p]) => {
        setAccounts(acc)
        setEntries(ent.data)
        setPnl(p)
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [from, to])

  useEffect(load, [load])

  const grouped = accounts.reduce((acc, a) => {
    acc[a.type] = acc[a.type] || []
    acc[a.type].push(a)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-slate-500">From</label>
        <input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
        <label className="text-xs text-slate-500">To</label>
        <input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {loading || !pnl ? (
        <Spinner full />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <div className="card p-4">
              <p className="flex items-center gap-1.5 text-xs uppercase text-slate-500"><TrendingUp size={13} /> Revenue</p>
              <p className="mt-1 text-xl font-semibold text-emerald-600">{currency(pnl.totalRevenue)}</p>
            </div>
            <div className="card p-4">
              <p className="flex items-center gap-1.5 text-xs uppercase text-slate-500"><TrendingDown size={13} /> Expenses</p>
              <p className="mt-1 text-xl font-semibold text-rose-600">{currency(pnl.totalExpense)}</p>
            </div>
            <div className="card col-span-2 p-4 lg:col-span-1">
              <p className="flex items-center gap-1.5 text-xs uppercase text-slate-500"><Landmark size={13} /> Net income</p>
              <p className={`mt-1 text-xl font-semibold ${pnl.netIncome >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>{currency(pnl.netIncome)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card p-4 sm:p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Revenue by account</h3>
              {pnl.revenue.length === 0 ? (
                <p className="text-sm text-slate-400">No revenue posted in this range.</p>
              ) : (
                <div className="space-y-1.5">
                  {pnl.revenue.map((r) => (
                    <div key={r.code} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{r.code} · {r.name}</span>
                      <span className="font-medium text-slate-800">{currency(r.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card p-4 sm:p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Expenses by account</h3>
              {pnl.expense.length === 0 ? (
                <p className="text-sm text-slate-400">No expenses posted in this range.</p>
              ) : (
                <div className="space-y-1.5">
                  {pnl.expense.map((r) => (
                    <div key={r.code} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{r.code} · {r.name}</span>
                      <span className="font-medium text-slate-800">{currency(r.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card p-4 sm:p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Chart of accounts</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(TYPE_LABEL).map(([type, label]) => (
                <div key={type}>
                  <p className="mb-1.5 text-xs font-semibold uppercase text-slate-400">{label}</p>
                  <div className="space-y-1">
                    {(grouped[type] || []).map((a) => (
                      <div key={a.code} className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">{a.code} {a.name}</span>
                        <span className="font-medium text-slate-700">{currency(a.balance)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden">
            <h3 className="p-4 pb-0 text-sm font-semibold text-slate-800 sm:p-5 sm:pb-0">
              <span className="flex items-center gap-1.5"><ScrollText size={15} /> Journal</span>
            </h3>
            {entries.length === 0 ? (
              <EmptyState icon={ScrollText} title="No journal entries in this range" />
            ) : (
              <div className="overflow-x-auto p-4 sm:p-5">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Memo</th>
                      <th>Source</th>
                      <th>Lines</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e._id}>
                        <td className="whitespace-nowrap text-xs text-slate-500">{format(new Date(e.postedAt), 'MMM d, h:mm a')}</td>
                        <td className="max-w-[240px] truncate">{e.memo}</td>
                        <td className="text-xs capitalize text-slate-500">{e.sourceEntity.replace('_', ' ')}</td>
                        <td className="text-xs text-slate-500">
                          {e.lines.map((l, i) => (
                            <div key={i}>
                              {l.account} {l.accountName}: {l.debit > 0 ? `Dr ${currency(l.debit)}` : `Cr ${currency(l.credit)}`}
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default Finance
