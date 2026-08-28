import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { Plus, LifeBuoy, AlertTriangle, Clock, Send, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { ticketsApi, customersApi, usersApi } from '../api/resources'
import { getErrorMessage } from '../api/client'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'

// Support tickets (04-growth/crm.md): damage claims, billing disputes, quality complaints,
// membership questions. Any authenticated staff member can work tickets — see ticketRoutes.js.
const CATEGORIES = ['damage-claim', 'billing-dispute', 'quality-complaint', 'membership-question', 'general']
const STATUSES = ['open', 'in-progress', 'waiting-on-customer', 'resolved', 'closed']
// Mirrors ticketController.js's ALLOWED_TRANSITIONS — kept in sync manually, same pattern
// used elsewhere in this app for status-action buttons (e.g. WashQueue.jsx).
const ALLOWED_TRANSITIONS = {
  open: ['in-progress'],
  'in-progress': ['waiting-on-customer', 'resolved'],
  'waiting-on-customer': ['in-progress', 'closed'],
  resolved: ['closed', 'in-progress'],
  closed: ['in-progress'],
}
const emptyForm = { customer: '', subject: '', category: 'general', priority: 'normal', description: '' }

const Tickets = () => {
  const [tickets, setTickets] = useState([])
  const [customers, setCustomers] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const [activeId, setActiveId] = useState(null)
  const [active, setActive] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [commentBody, setCommentBody] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const params = {}
    if (statusFilter) params.status = statusFilter
    if (categoryFilter) params.category = categoryFilter
    Promise.all([ticketsApi.list(params), customersApi.list({ limit: 200 }), usersApi.list()])
      .then(([t, c, u]) => {
        setTickets(t)
        setCustomers(c.data || c)
        setStaff(u.filter((usr) => usr.active !== false))
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [statusFilter, categoryFilter])

  useEffect(load, [load])

  const loadDetail = useCallback((id) => {
    setDetailLoading(true)
    ticketsApi
      .get(id)
      .then(setActive)
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setDetailLoading(false))
  }, [])

  useEffect(() => {
    if (activeId) loadDetail(activeId)
    else setActive(null)
  }, [activeId, loadDetail])

  const submitCreate = async (e) => {
    e.preventDefault()
    if (!form.customer || !form.subject) {
      toast.error('Customer and subject are required')
      return
    }
    setSaving(true)
    try {
      await ticketsApi.create(form)
      toast.success('Ticket created')
      setCreateOpen(false)
      setForm(emptyForm)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const transition = async (status) => {
    setBusy(true)
    try {
      await ticketsApi.updateStatus(active._id, status)
      toast.success(`Ticket moved to ${status}`)
      loadDetail(active._id)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const assign = async (userId) => {
    setBusy(true)
    try {
      await ticketsApi.assign(active._id, userId || null)
      loadDetail(active._id)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const submitComment = async (e) => {
    e.preventDefault()
    if (!commentBody.trim()) return
    setBusy(true)
    try {
      await ticketsApi.addComment(active._id, commentBody.trim())
      setCommentBody('')
      loadDetail(active._id)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <select className="input w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select className="input w-auto" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <button className="btn-primary" onClick={() => { setForm(emptyForm); setCreateOpen(true) }}>
          <Plus size={16} /> New ticket
        </button>
      </div>

      {loading ? (
        <Spinner full />
      ) : tickets.length === 0 ? (
        <div className="card"><EmptyState icon={LifeBuoy} title="No tickets" message="Nothing matches these filters." /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Customer</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>SLA</th>
                  <th>Assigned</th>
                  <th>Opened</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t._id} className="cursor-pointer hover:bg-slate-50" onClick={() => setActiveId(t._id)}>
                    <td className="max-w-[220px] truncate font-medium text-slate-800">{t.subject}</td>
                    <td>{t.customer?.name}</td>
                    <td className="capitalize">{t.category}</td>
                    <td><Badge status={t.priority}>{t.priority}</Badge></td>
                    <td><Badge status={t.status}>{t.status}</Badge></td>
                    <td>
                      {t.sla?.breached ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-rose-600"><AlertTriangle size={13} /> Breached</span>
                      ) : t.sla?.atRisk ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-amber-600"><Clock size={13} /> At risk</span>
                      ) : (
                        <span className="text-xs text-slate-400">On track</span>
                      )}
                    </td>
                    <td>{t.assignedTo?.name || <span className="text-slate-400">Unassigned</span>}</td>
                    <td className="whitespace-nowrap text-xs text-slate-500">{format(new Date(t.createdAt), 'MMM d, h:mm a')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New ticket">
        <form id="ticket-create-form" onSubmit={submitCreate} className="space-y-3">
          <div>
            <label className="label">Customer</label>
            <select className="input" value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} required>
              <option value="">Select a customer…</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>{c.name} · {c.phone}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Subject</label>
            <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {['low', 'normal', 'high', 'urgent'].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </form>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
          <button type="submit" form="ticket-create-form" className="btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create ticket'}</button>
        </div>
      </Modal>

      <Modal open={!!activeId} onClose={() => setActiveId(null)} title={active?.subject || 'Ticket'} size="lg">
        {detailLoading || !active ? (
          <Spinner full />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge status={active.status}>{active.status}</Badge>
              <Badge status={active.priority}>{active.priority}</Badge>
              <span className="text-xs capitalize text-slate-500">{active.category}</span>
              {active.sla?.breached && <span className="flex items-center gap-1 text-xs font-medium text-rose-600"><AlertTriangle size={13} /> SLA breached</span>}
              {!active.sla?.breached && active.sla?.atRisk && <span className="flex items-center gap-1 text-xs font-medium text-amber-600"><Clock size={13} /> SLA at risk</span>}
            </div>

            {active.description && <p className="text-sm text-slate-600">{active.description}</p>}

            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 text-xs text-slate-500"><UserCheck size={13} /> Assigned to</span>
              <select
                className="input w-auto"
                value={active.assignedTo?._id || ''}
                disabled={busy}
                onChange={(e) => assign(e.target.value)}
              >
                <option value="">Unassigned</option>
                {staff.map((u) => (
                  <option key={u._id} value={u._id}>{u.name}</option>
                ))}
              </select>
              <div className="ml-auto flex flex-wrap gap-2">
                {(ALLOWED_TRANSITIONS[active.status] || []).map((next) => (
                  <button key={next} className="btn-secondary" disabled={busy} onClick={() => transition(next)}>
                    Move to {next}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-800">Activity</h4>
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-100 p-3">
                {active.comments?.length ? (
                  active.comments.map((c) => (
                    <div key={c._id} className={`rounded-lg px-3 py-2 text-sm ${c.authorType === 'system' ? 'bg-slate-50 italic text-slate-500' : 'bg-brand-50 text-slate-700'}`}>
                      {c.authorType !== 'system' && <p className="mb-0.5 text-xs font-semibold text-slate-500">{c.author?.name || 'Staff'}</p>}
                      <p>{c.body}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No activity yet.</p>
                )}
              </div>
            </div>

            <form onSubmit={submitComment} className="flex gap-2">
              <input className="input flex-1" placeholder="Add a comment…" value={commentBody} onChange={(e) => setCommentBody(e.target.value)} />
              <button className="btn-primary shrink-0" disabled={busy} type="submit">
                <Send size={15} />
              </button>
            </form>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default Tickets
