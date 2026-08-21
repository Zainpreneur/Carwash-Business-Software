import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Sparkles, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { servicesApi } from '../api/resources'
import { getErrorMessage } from '../api/client'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'
import { useAuth } from '../context/AuthContext'

const categories = ['basic', 'premium', 'detailing', 'addon']
const categoryColor = { basic: 'blue', premium: 'purple', detailing: 'amber', addon: 'cyan' }

const emptyForm = { name: '', description: '', category: 'basic', price: '', durationMinutes: 30, active: true }

const Services = () => {
  const { user } = useAuth()
  const canEdit = user?.role === 'admin' || user?.role === 'manager'
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    servicesApi
      .list()
      .then(setServices)
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (s) => {
    setEditing(s)
    setForm({ name: s.name, description: s.description || '', category: s.category, price: s.price, durationMinutes: s.durationMinutes, active: s.active })
    setModalOpen(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, price: Number(form.price), durationMinutes: Number(form.durationMinutes) }
      if (editing) {
        await servicesApi.update(editing._id, payload)
        toast.success('Service updated')
      } else {
        await servicesApi.create(payload)
        toast.success('Service created')
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
      await servicesApi.remove(deleteTarget._id)
      toast.success('Service removed')
      setDeleteTarget(null)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{services.length} services in catalog</p>
        {canEdit && (
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={16} /> Add service
          </button>
        )}
      </div>

      {loading ? (
        <Spinner full />
      ) : services.length === 0 ? (
        <div className="card">
          <EmptyState icon={Sparkles} title="No services yet" message="Create your first service package." />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <div key={s._id} className="card flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-900">{s.name}</h3>
                  <Badge color={categoryColor[s.category]} className="mt-1.5 capitalize">{s.category}</Badge>
                </div>
                <p className="text-lg font-bold text-brand-600">${Number(s.price).toFixed(2)}</p>
              </div>
              {s.description && <p className="mt-2 text-sm text-slate-500">{s.description}</p>}
              <div className="mt-3 flex items-center gap-1 text-xs text-slate-400">
                <Clock size={12} /> {s.durationMinutes} min
                {!s.active && <Badge color="red" className="ml-auto">Inactive</Badge>}
              </div>
              {canEdit && (
                <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                  <button onClick={() => openEdit(s)} className="btn-secondary flex-1 py-1.5 text-xs">
                    <Pencil size={13} /> Edit
                  </button>
                  <button onClick={() => setDeleteTarget(s)} className="btn-secondary flex-1 py-1.5 text-xs text-rose-600 hover:bg-rose-50">
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit service' : 'Add service'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" form="service-form" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save service'}
            </button>
          </>
        }
      >
        <form id="service-form" onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Service name</label>
            <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea rows={2} className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <select className="input capitalize" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Price ($)</label>
              <input required type="number" min="0" step="0.01" className="input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Duration (minutes)</label>
              <input required type="number" min="5" className="input" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                Active service
              </label>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete service"
        message={`Remove "${deleteTarget?.name}" from the catalog?`}
      />
    </div>
  )
}

export default Services
