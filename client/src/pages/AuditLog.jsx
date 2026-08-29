import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { auditLogApi } from '../api/resources'
import { getErrorMessage } from '../api/client'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { ScrollText, User, Bot, Server } from 'lucide-react'

// 01-foundation/security.md's audit log — "every create/update/delete on WashOrder, Invoice,
// Payment, MembershipSubscription, JournalEntry, and Employee writes to an append-only audit
// log: actor, timestamp, before/after diff. Agent actions are logged identically to human
// ones." This app has no separate Invoice/Payment entities (see auditLogs' own schema
// comment), so this covers the four that exist. Read-only by design — there is no edit/delete
// action anywhere on this page, matching "append-only" in more than name.
const ENTITY_LABEL = {
  wash_order: 'Wash Order',
  membership_subscription: 'Membership Subscription',
  journal_entry: 'Journal Entry',
  employee: 'Employee',
}
const ENTITIES = Object.keys(ENTITY_LABEL)

const ACTOR_ICON = { user: User, agent: Bot, system: Server }

// Shows only the fields that actually changed between before/after — a raw side-by-side JSON
// dump buries the one field that moved in a wall of unchanged ids/timestamps.
const diffFields = (before, after) => {
  if (!before) return Object.entries(after || {}).map(([key, value]) => ({ key, from: undefined, to: value }))
  if (!after) return Object.entries(before || {}).map(([key, value]) => ({ key, from: value, to: undefined }))
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const changed = []
  for (const key of keys) {
    if (key === 'updatedAt' || key === 'createdAt') continue
    const a = JSON.stringify(before[key])
    const b = JSON.stringify(after[key])
    if (a !== b) changed.push({ key, from: before[key], to: after[key] })
  }
  return changed
}

const display = (v) => {
  if (v === undefined) return '—'
  if (v === null) return 'null'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

const AuditLog = () => {
  const [rows, setRows] = useState([])
  const [entity, setEntity] = useState('')
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    auditLogApi
      .list({ entity: entity || undefined, limit: 200 })
      .then(setRows)
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [entity])

  useEffect(load, [load])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setEntity('')} className={`rounded-full px-3 py-1 text-xs font-medium ${entity === '' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>All</button>
          {ENTITIES.map((e) => (
            <button key={e} onClick={() => setEntity(e)} className={`rounded-full px-3 py-1 text-xs font-medium ${entity === e ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>{ENTITY_LABEL[e]}</button>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Append-only: every create/update/delete on these four entities is logged here permanently, including AI-agent-initiated actions (e.g. wash-concierge signing a customer up for membership or cancelling one over WhatsApp) logged identically to a staff action.
      </p>

      {loading ? (
        <Spinner full />
      ) : rows.length === 0 ? (
        <div className="card"><EmptyState icon={ScrollText} title="No audit entries yet" /></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>When</th><th>Entity</th><th>Action</th><th>Actor</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const ActorIcon = ACTOR_ICON[r.actorType] || User
                return (
                  <tr key={r._id}>
                    <td className="whitespace-nowrap text-xs text-slate-500">{format(new Date(r.createdAt), 'MMM d, h:mm:ss a')}</td>
                    <td>{ENTITY_LABEL[r.entity] || r.entity}</td>
                    <td><Badge status={r.action === 'create' ? 'active' : r.action === 'delete' ? 'cancelled' : 'confirmed'}>{r.action}</Badge></td>
                    <td>
                      <span className="flex items-center gap-1.5 text-xs text-slate-600">
                        <ActorIcon size={13} className={r.actorType === 'agent' ? 'text-violet-500' : r.actorType === 'system' ? 'text-slate-400' : 'text-blue-500'} />
                        {r.actorName || '—'}
                      </span>
                    </td>
                    <td className="text-right">
                      <button className="btn-secondary py-1 text-xs" onClick={() => setDetail(r)}>View diff</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `${ENTITY_LABEL[detail.entity]} — ${detail.action}` : ''} size="lg">
        {detail && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              {detail.action === 'create' ? 'Created' : detail.action === 'delete' ? 'Deleted' : 'Changed'} fields:
            </p>
            {diffFields(detail.before, detail.after).length === 0 ? (
              <p className="text-sm text-slate-400">No field-level changes recorded.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
                  <tbody>
                    {diffFields(detail.before, detail.after).map((f) => (
                      <tr key={f.key}>
                        <td className="font-medium text-slate-800">{f.key}</td>
                        <td className="text-rose-600">{display(f.from)}</td>
                        <td className="text-emerald-600">{display(f.to)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default AuditLog
