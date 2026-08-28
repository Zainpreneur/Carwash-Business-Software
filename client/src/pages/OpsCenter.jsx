import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { LayoutGrid, Send, HeartPulse, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { agentOpsApi, integrationsApi } from '../api/resources'
import { getErrorMessage } from '../api/client'
import Spinner from '../components/ui/Spinner'
import Badge from '../components/ui/Badge'

// Ops Center — ops-orchestrator, strategy-advisor, system-health-agent
// (02-intelligence/ai-agents.md's "Orchestrator" and "Advisor agents" clusters), the last
// two clusters of the 12-agent roster this app implements against real entities.
// ops-orchestrator makes no Claude call (pure aggregation/routing); strategy-advisor and
// system-health-agent do, and both fall back to a plain, still-useful answer without
// ANTHROPIC_API_KEY configured — the same posture as every other agent in this app.
const PATTERN_LABEL = {
  'unit-economics': 'Unit economics',
  'scenario-comparison': 'Scenario comparison',
  'root-cause-5-whys': 'Root-cause (5 whys)',
  'decision-matrix': 'Decision matrix',
  none: 'No pattern (fallback)',
}

const OpsCenter = () => {
  const [snapshot, setSnapshot] = useState(null)
  const [history, setHistory] = useState([])
  const [integrations, setIntegrations] = useState(null)
  const [loading, setLoading] = useState(true)
  const [question, setQuestion] = useState('Should we raise Basic Unlimited pricing?')
  const [asking, setAsking] = useState(false)
  const [report, setReport] = useState(null)
  const [runningReport, setRunningReport] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([agentOpsApi.orchestratorSnapshot(), agentOpsApi.strategyAdvisorHistory(), integrationsApi.status()])
      .then(([snap, hist, integ]) => {
        setSnapshot(snap)
        setHistory(hist)
        setIntegrations(integ)
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const askAdvisor = async (e) => {
    e.preventDefault()
    if (!question.trim()) return
    setAsking(true)
    try {
      await agentOpsApi.askStrategyAdvisor(question.trim())
      toast.success('strategy-advisor answered')
      const hist = await agentOpsApi.strategyAdvisorHistory()
      setHistory(hist)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setAsking(false)
    }
  }

  const runHealthReport = async () => {
    setRunningReport(true)
    try {
      setReport(await agentOpsApi.systemHealthReport())
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setRunningReport(false)
    }
  }

  if (loading || !snapshot) return <Spinner full />

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-center gap-4 p-4">
        <span className="text-sm font-semibold text-slate-800">AI agents</span>
        <span className="flex items-center gap-1.5 text-sm text-slate-600">
          <Badge status={integrations?.agents?.configured ? 'active' : 'inactive'}>{integrations?.agents?.configured ? 'Claude connected' : 'Deterministic fallback'}</Badge>
        </span>
      </div>

      <div className="card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><LayoutGrid size={15} /> Operating picture (ops-orchestrator)</h3>
          <button className="btn-secondary py-1 text-xs" onClick={load}><RefreshCw size={13} /> Refresh</button>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-3 text-center"><p className="text-lg font-semibold text-slate-900">{snapshot.queueDepth}</p><p className="text-xs text-slate-500">Queued</p></div>
          <div className="rounded-lg bg-slate-50 p-3 text-center"><p className="text-lg font-semibold text-slate-900">{snapshot.activeOrderCount}</p><p className="text-xs text-slate-500">Active orders</p></div>
          <div className="rounded-lg bg-slate-50 p-3 text-center"><p className="text-lg font-semibold text-slate-900">{snapshot.bayStatus.operational}</p><p className="text-xs text-slate-500">Bays operational</p></div>
          <div className="rounded-lg bg-slate-50 p-3 text-center"><p className="text-lg font-semibold text-slate-900">{snapshot.openTicketCount}</p><p className="text-xs text-slate-500">Open tickets</p></div>
        </div>
        {snapshot.allClear ? (
          <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600"><CheckCircle2 size={15} /> All clear — nothing routed to a specialist right now.</p>
        ) : (
          <div className="space-y-1.5">
            {snapshot.routedItems.map((item, i) => (
              <p key={i} className="flex items-center gap-1.5 text-sm text-slate-600">
                <AlertTriangle size={13} className="shrink-0 text-amber-500" />
                <span className="font-medium text-slate-800">{item.condition}</span> → {item.routedTo}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="card p-4 sm:p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Ask strategy-advisor</h3>
        <form onSubmit={askAdvisor} className="flex flex-col gap-2 sm:flex-row">
          <input className="input flex-1" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Should we add a 5th tunnel bay?" />
          <button className="btn-primary shrink-0" disabled={asking} type="submit"><Send size={15} /> {asking ? 'Thinking…' : 'Ask'}</button>
        </form>
        <div className="mt-4 space-y-3">
          {history.length === 0 ? (
            <p className="text-sm text-slate-400">No questions asked yet.</p>
          ) : (
            history.map((h) => (
              <div key={h._id} className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-800">{h.question}</p>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{h.answer}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge color="blue">{PATTERN_LABEL[h.pattern] || h.pattern}</Badge>
                  {h.confidencePercent != null && <span className="text-xs text-slate-400">Confidence: {h.confidencePercent}%</span>}
                  <span className="ml-auto text-xs text-slate-400">{format(new Date(h.createdAt), 'MMM d, h:mm a')}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><HeartPulse size={15} /> system-health-agent weekly report</h3>
          <button className="btn-primary" disabled={runningReport} onClick={runHealthReport}>{runningReport ? 'Running…' : 'Generate report'}</button>
        </div>
        {report && (
          <div className="space-y-3">
            {report.narrative && <p className="text-sm text-slate-700">{report.narrative}</p>}
            {report.note && <p className="text-xs italic text-slate-400">{report.note}</p>}
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Agent</th><th>Calls (7d)</th><th>AI-agent rate</th><th>Fallback rate</th><th>Escalation rate</th></tr></thead>
                <tbody>
                  {report.metrics.length === 0 ? (
                    <tr><td colSpan={5} className="text-center text-slate-400">No agent activity in the last 7 days.</td></tr>
                  ) : (
                    report.metrics.map((m) => (
                      <tr key={m.agentName}>
                        <td className="font-medium text-slate-800">{m.agentName}</td>
                        <td>{m.invocations}</td>
                        <td>{m.aiAgentRate != null ? `${m.aiAgentRate}%` : '—'}</td>
                        <td>{m.fallbackRate != null ? `${m.fallbackRate}%` : '—'}</td>
                        <td>{m.escalationRate != null ? `${m.escalationRate}%` : '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default OpsCenter
