import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { Plus, Key, Webhook, History, Copy, RotateCw, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { platformApi, customersApi } from '../api/resources'
import { getErrorMessage } from '../api/client'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'

// Platform API & Webhooks (06-platform/api-webhooks.md) — "a light but real API surface...
// the fleet segment and a future companion mobile app both need something to integrate
// against." Admin-only management for the partner-facing /api/v1 surface
// (server/src/routes/v1Routes.js) and its outbound webhooks (server/src/services/webhookService.js).
// The spec's own developer-experience note says a self-serve portal isn't warranted at this
// scale ("manually issued keys are enough") — this is that manual issuance, not a portal.
const SCOPES = [
  { value: 'orders-readwrite', label: 'Orders Read/Write' },
  { value: 'fleet-account-readonly', label: 'Fleet Account Read-Only' },
]
const EVENTS = ['wash-order-ready', 'wash-order-completed', 'membership-cancelled', 'stock-low']

const TABS = [
  { key: 'keys', label: 'API Keys', icon: Key },
  { key: 'webhooks', label: 'Webhooks', icon: Webhook },
  { key: 'deliveries', label: 'Delivery Log', icon: History },
]

const emptyKeyForm = { name: '', scope: 'orders-readwrite', fleetCustomer: '' }
const emptyWebhookForm = { url: '', events: [] }

const Platform = () => {
  const [tab, setTab] = useState('keys')
  const [keys, setKeys] = useState([])
  const [webhooks, setWebhooks] = useState([])
  const [deliveries, setDeliveries] = useState([])
  const [fleetCustomers, setFleetCustomers] = useState([])
  const [loading, setLoading] = useState(true)

  const [keyModalOpen, setKeyModalOpen] = useState(false)
  const [keyForm, setKeyForm] = useState(emptyKeyForm)
  const [newRawKey, setNewRawKey] = useState(null)
  const [webhookModalOpen, setWebhookModalOpen] = useState(false)
  const [webhookForm, setWebhookForm] = useState(emptyWebhookForm)
  const [newSecret, setNewSecret] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([platformApi.apiKeys.list(), platformApi.webhooks.list(), platformApi.deliveries.list(), customersApi.list({ limit: 100 })])
      .then(([k, w, d, c]) => {
        setKeys(k)
        setWebhooks(w)
        setDeliveries(d)
        setFleetCustomers((c.data || []).filter((cust) => cust.isFleetAccount))
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const copy = (text) => {
    navigator.clipboard?.writeText(text)
    toast.success('Copied to clipboard')
  }

  const submitKey = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { name: keyForm.name, scope: keyForm.scope, fleetCustomer: keyForm.scope === 'fleet-account-readonly' ? keyForm.fleetCustomer : undefined }
      const created = await platformApi.apiKeys.create(payload)
      setNewRawKey(created.rawKey)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const revokeKey = async (id) => {
    try {
      await platformApi.apiKeys.revoke(id)
      toast.success('Key revoked')
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const toggleEvent = (event) => {
    setWebhookForm((f) => ({ ...f, events: f.events.includes(event) ? f.events.filter((e) => e !== event) : [...f.events, event] }))
  }

  const submitWebhook = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const created = await platformApi.webhooks.create(webhookForm)
      setNewSecret(created.secret)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const removeWebhook = async (id) => {
    if (!window.confirm('Remove this webhook subscription?')) return
    try {
      await platformApi.webhooks.remove(id)
      toast.success('Subscription removed')
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const replay = async (id) => {
    try {
      await platformApi.deliveries.replay(id)
      toast.success('Redelivered')
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  if (loading) return <Spinner full />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-medium ${tab === t.key ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'keys' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button className="btn-primary" onClick={() => { setKeyForm(emptyKeyForm); setNewRawKey(null); setKeyModalOpen(true) }}>
              <Plus size={16} /> Issue key
            </button>
          </div>
          {keys.length === 0 ? (
            <div className="card"><EmptyState icon={Key} title="No API keys issued yet" /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Name</th><th>Key</th><th>Scope</th><th>Fleet account</th><th>Last used</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {keys.map((k) => (
                      <tr key={k._id}>
                        <td className="font-medium text-slate-800">{k.name}</td>
                        <td className="font-mono text-xs text-slate-500">{k.keyPrefix}…</td>
                        <td className="text-xs">{SCOPES.find((s) => s.value === k.scope)?.label || k.scope}</td>
                        <td className="text-xs text-slate-500">{k.fleetCustomer?.name || '—'}</td>
                        <td className="text-xs text-slate-400">{k.lastUsedAt ? format(new Date(k.lastUsedAt), 'MMM d, h:mm a') : 'Never'}</td>
                        <td><Badge status={k.active ? 'active' : 'cancelled'}>{k.active ? 'active' : 'revoked'}</Badge></td>
                        <td>
                          {k.active && (
                            <button className="btn-secondary py-1 text-xs" onClick={() => revokeKey(k._id)}>Revoke</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'webhooks' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button className="btn-primary" onClick={() => { setWebhookForm(emptyWebhookForm); setNewSecret(null); setWebhookModalOpen(true) }}>
              <Plus size={16} /> Add subscription
            </button>
          </div>
          {webhooks.length === 0 ? (
            <div className="card"><EmptyState icon={Webhook} title="No webhook subscriptions yet" /></div>
          ) : (
            <div className="space-y-2">
              {webhooks.map((w) => (
                <div key={w._id} className="card flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-slate-800">{w.url}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {w.events.map((e) => <Badge key={e} color="blue">{e}</Badge>)}
                    </div>
                  </div>
                  <button className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" onClick={() => removeWebhook(w._id)}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'deliveries' && (
        <div className="space-y-3">
          {deliveries.length === 0 ? (
            <div className="card"><EmptyState icon={History} title="No deliveries yet" /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>When</th><th>Event</th><th>Subscriber</th><th>Status</th><th>Attempts</th><th></th></tr></thead>
                  <tbody>
                    {deliveries.map((d) => (
                      <tr key={d._id}>
                        <td className="whitespace-nowrap text-xs text-slate-500">{format(new Date(d.createdAt), 'MMM d, h:mm:ss a')}</td>
                        <td className="text-xs">{d.eventType}</td>
                        <td className="text-xs text-slate-500">{d.subscriptionUrl}</td>
                        <td><Badge status={d.status === 'delivered' ? 'active' : 'cancelled'}>{d.status}</Badge></td>
                        <td className="text-xs">{d.attempts}{d.lastError ? ` (${d.lastError})` : ''}</td>
                        <td>
                          <button className="btn-secondary py-1 text-xs" onClick={() => replay(d._id)}><RotateCw size={12} /> Replay</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Issue key */}
      <Modal open={keyModalOpen} onClose={() => setKeyModalOpen(false)} title="Issue API key">
        {newRawKey ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Copy this key now — it won't be shown again.</p>
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3">
              <code className="flex-1 break-all text-xs">{newRawKey}</code>
              <button className="btn-secondary py-1 text-xs" onClick={() => copy(newRawKey)}><Copy size={13} /></button>
            </div>
          </div>
        ) : (
          <form id="key-form" onSubmit={submitKey} className="space-y-3">
            <div><label className="label">Name</label><input className="input" value={keyForm.name} onChange={(e) => setKeyForm({ ...keyForm, name: e.target.value })} required /></div>
            <div>
              <label className="label">Scope</label>
              <select className="input" value={keyForm.scope} onChange={(e) => setKeyForm({ ...keyForm, scope: e.target.value })}>
                {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            {keyForm.scope === 'fleet-account-readonly' && (
              <div>
                <label className="label">Fleet account</label>
                <select className="input" value={keyForm.fleetCustomer} onChange={(e) => setKeyForm({ ...keyForm, fleetCustomer: e.target.value })} required>
                  <option value="">Select a fleet account…</option>
                  {fleetCustomers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
            )}
          </form>
        )}
        <div className="mt-4 flex justify-end gap-2">
          {newRawKey ? (
            <button className="btn-primary" onClick={() => setKeyModalOpen(false)}>Done</button>
          ) : (
            <>
              <button type="button" className="btn-secondary" onClick={() => setKeyModalOpen(false)}>Cancel</button>
              <button type="submit" form="key-form" className="btn-primary" disabled={saving}>{saving ? 'Issuing…' : 'Issue key'}</button>
            </>
          )}
        </div>
      </Modal>

      {/* Add webhook subscription */}
      <Modal open={webhookModalOpen} onClose={() => setWebhookModalOpen(false)} title="Add webhook subscription">
        {newSecret ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Signing secret — copy this now, it won't be shown again. Every payload to this URL is HMAC-signed with it (X-Webhook-Signature header).</p>
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3">
              <code className="flex-1 break-all text-xs">{newSecret}</code>
              <button className="btn-secondary py-1 text-xs" onClick={() => copy(newSecret)}><Copy size={13} /></button>
            </div>
          </div>
        ) : (
          <form id="webhook-form" onSubmit={submitWebhook} className="space-y-3">
            <div><label className="label">URL</label><input type="url" className="input" value={webhookForm.url} onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })} required /></div>
            <div>
              <label className="label">Events</label>
              <div className="space-y-1.5">
                {EVENTS.map((e) => (
                  <label key={e} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={webhookForm.events.includes(e)} onChange={() => toggleEvent(e)} />
                    {e}
                  </label>
                ))}
              </div>
            </div>
          </form>
        )}
        <div className="mt-4 flex justify-end gap-2">
          {newSecret ? (
            <button className="btn-primary" onClick={() => setWebhookModalOpen(false)}>Done</button>
          ) : (
            <>
              <button type="button" className="btn-secondary" onClick={() => setWebhookModalOpen(false)}>Cancel</button>
              <button type="submit" form="webhook-form" className="btn-primary" disabled={saving || webhookForm.events.length === 0}>{saving ? 'Saving…' : 'Subscribe'}</button>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default Platform
