import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Users2, PauseCircle, PlayCircle, XCircle, CreditCard, MessageCircle, Bot } from 'lucide-react'
import toast from 'react-hot-toast'
import { membershipPlansApi, membershipSubscriptionsApi, washPackagesApi, integrationsApi } from '../api/resources'
import { getErrorMessage } from '../api/client'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'

const tiers = ['basic-unlimited', 'premium-unlimited', 'fleet-unlimited']
const emptyForm = { tier: 'basic-unlimited', name: '', coveredPackage: '', monthlyPrice: '', isUnlimited: true, washesPerMonthCap: '', rolloverAllowed: false, active: true }

const MembershipPlans = () => {
  const [plans, setPlans] = useState([])
  const [subs, setSubs] = useState([])
  const [packages, setPackages] = useState([])
  const [integrations, setIntegrations] = useState(null)
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([membershipPlansApi.list(), membershipSubscriptionsApi.list(), washPackagesApi.list({ active: true }), integrationsApi.status()])
      .then(([p, s, pkgs, integ]) => {
        setPlans(p)
        setSubs(s)
        setPackages(pkgs)
        setIntegrations(integ)
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (p) => {
    setEditing(p)
    setForm({
      tier: p.tier,
      name: p.name,
      coveredPackage: p.coveredPackage,
      monthlyPrice: p.monthlyPrice,
      isUnlimited: p.isUnlimited,
      washesPerMonthCap: p.washesPerMonthCap || '',
      rolloverAllowed: p.rolloverAllowed,
      active: p.active,
    })
    setModalOpen(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        monthlyPrice: Number(form.monthlyPrice),
        washesPerMonthCap: form.washesPerMonthCap ? Number(form.washesPerMonthCap) : null,
      }
      if (editing) {
        await membershipPlansApi.update(editing._id, payload)
        toast.success('Plan updated')
      } else {
        await membershipPlansApi.create(payload)
        toast.success('Plan created')
      }
      setModalOpen(false)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await membershipPlansApi.remove(deleteTarget._id)
      toast.success('Plan removed')
      setDeleteTarget(null)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  const runSubAction = async (id, fn, msg) => {
    setBusyId(id)
    try {
      await fn()
      toast.success(msg)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <Spinner full />

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center gap-4 p-4">
        <span className="text-sm font-semibold text-slate-800">Integrations</span>
        <span className="flex items-center gap-1.5 text-sm text-slate-600">
          <CreditCard size={15} />
          Stripe: <Badge status={integrations?.stripe?.configured ? 'active' : 'inactive'}>{integrations?.stripe?.configured ? 'Connected' : 'Not connected (demo mode)'}</Badge>
        </span>
        <span className="flex items-center gap-1.5 text-sm text-slate-600">
          <MessageCircle size={15} />
          WhatsApp: <Badge status={integrations?.whatsapp?.configured ? 'active' : 'inactive'}>{integrations?.whatsapp?.configured ? 'Connected' : 'Not connected'}</Badge>
        </span>
        <span className="flex items-center gap-1.5 text-sm text-slate-600">
          <Bot size={15} />
          AI agents: <Badge status={integrations?.agents?.configured ? 'active' : 'inactive'}>{integrations?.agents?.configured ? 'Connected' : 'Deterministic fallback'}</Badge>
        </span>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{plans.length} membership plans</p>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={16} /> Add plan
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="card"><EmptyState icon={Users2} title="No plans yet" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <div key={p._id} className="card flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-900">{p.name}</h3>
                  <Badge color="blue" className="mt-1.5 capitalize">{p.tier.replace('-', ' ')}</Badge>
                </div>
                <p className="text-lg font-bold text-brand-600">${p.monthlyPrice.toFixed(2)}/mo</p>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {p.isUnlimited ? 'Unlimited washes' : `${p.washesPerMonthCap ?? '—'} washes/mo`} · {p.rolloverAllowed ? 'rollover allowed' : 'no rollover'}
              </p>
              <p className="mt-1 text-xs text-slate-400">{p.stripePriceId ? 'Synced to Stripe' : 'No Stripe price yet'}</p>
              {!p.active && <Badge color="red" className="mt-2 w-fit">Inactive</Badge>}
              <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                <button onClick={() => openEdit(p)} className="btn-secondary flex-1 py-1.5 text-xs">
                  <Pencil size={13} /> Edit
                </button>
                <button onClick={() => setDeleteTarget(p)} className="btn-secondary flex-1 py-1.5 text-xs text-rose-600 hover:bg-rose-50">
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Subscriptions</h3>
        {subs.length === 0 ? (
          <div className="card"><EmptyState title="No members yet" /></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Vehicle</th>
                  <th>Plan</th>
                  <th>Next billing</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s._id}>
                    <td className="font-medium text-slate-900">{s.customer.name}</td>
                    <td>{s.vehicle.plateNumber}</td>
                    <td>{s.plan.name}</td>
                    <td>{s.nextBillingDate ? new Date(s.nextBillingDate).toLocaleDateString() : '—'}</td>
                    <td><Badge status={s.status}>{s.status}</Badge></td>
                    <td>
                      <div className="flex justify-end gap-1">
                        {s.status === 'active' && (
                          <button disabled={busyId === s._id} onClick={() => runSubAction(s._id, () => membershipSubscriptionsApi.pause(s._id), 'Paused')} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Pause">
                            <PauseCircle size={15} />
                          </button>
                        )}
                        {s.status === 'paused' && (
                          <button disabled={busyId === s._id} onClick={() => runSubAction(s._id, () => membershipSubscriptionsApi.resume(s._id), 'Resumed')} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Resume">
                            <PlayCircle size={15} />
                          </button>
                        )}
                        {['past-due', 'suspended'].includes(s.status) && (
                          <button disabled={busyId === s._id} onClick={() => runSubAction(s._id, () => membershipSubscriptionsApi.markPaid(s._id), 'Marked as paid')} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Mark paid (e.g. cash at counter)">
                            <CreditCard size={15} />
                          </button>
                        )}
                        {['active', 'past-due', 'suspended', 'paused'].includes(s.status) && (
                          <button disabled={busyId === s._id} onClick={() => runSubAction(s._id, () => membershipSubscriptionsApi.cancel(s._id), 'Cancelled')} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" title="Cancel">
                            <XCircle size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit plan' : 'Add plan'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" form="plan-form" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save plan'}
            </button>
          </>
        }
      >
        <form id="plan-form" onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Plan name</label>
            <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tier</label>
              <select className="input capitalize" value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })}>
                {tiers.map((t) => <option key={t} value={t}>{t.replace('-', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Monthly price ($)</label>
              <input required type="number" min="0" step="0.01" className="input" value={form.monthlyPrice} onChange={(e) => setForm({ ...form, monthlyPrice: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Covered wash package</label>
            <select required className="input" value={form.coveredPackage} onChange={(e) => setForm({ ...form, coveredPackage: e.target.value })}>
              <option value="">Select a package…</option>
              {packages.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
              <input type="checkbox" checked={form.isUnlimited} onChange={(e) => setForm({ ...form, isUnlimited: e.target.checked })} />
              Unlimited washes
            </label>
            {!form.isUnlimited && (
              <div>
                <label className="label">Washes / month cap</label>
                <input type="number" min="1" className="input" value={form.washesPerMonthCap} onChange={(e) => setForm({ ...form, washesPerMonthCap: e.target.value })} />
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.rolloverAllowed} onChange={(e) => setForm({ ...form, rolloverAllowed: e.target.checked })} />
            Allow rollover
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Active plan
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete plan"
        message={`Remove "${deleteTarget?.name}"?`}
      />
    </div>
  )
}

export default MembershipPlans
