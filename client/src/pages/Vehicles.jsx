import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Pencil, Trash2, Car } from 'lucide-react'
import toast from 'react-hot-toast'
import { vehiclesApi } from '../api/resources'
import { getErrorMessage } from '../api/client'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import CustomerPicker from '../components/shared/CustomerPicker'

const emptyForm = { customer: null, make: '', model: '', year: '', color: '', plateNumber: '', type: 'sedan' }

const vehicleTypes = ['sedan', 'suv', 'truck', 'van', 'motorcycle', 'other']

const Vehicles = () => {
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    vehiclesApi
      .list({ search })
      .then(setVehicles)
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [search])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (v) => {
    setEditing(v)
    setForm({
      customer: v.customer,
      make: v.make,
      model: v.model,
      year: v.year || '',
      color: v.color || '',
      plateNumber: v.plateNumber,
      type: v.type,
    })
    setModalOpen(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.customer) {
      toast.error('Please select a customer')
      return
    }
    setSaving(true)
    try {
      const payload = { ...form, customer: form.customer._id, year: form.year ? Number(form.year) : undefined }
      if (editing) {
        await vehiclesApi.update(editing._id, payload)
        toast.success('Vehicle updated')
      } else {
        await vehiclesApi.create(payload)
        toast.success('Vehicle added')
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
      await vehiclesApi.remove(deleteTarget._id)
      toast.success('Vehicle removed')
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search plate number…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn-primary shrink-0" onClick={openCreate}>
          <Plus size={16} /> Add vehicle
        </button>
      </div>

      {loading ? (
        <Spinner full />
      ) : vehicles.length === 0 ? (
        <div className="card">
          <EmptyState icon={Car} title="No vehicles found" message="Add a vehicle to a customer profile to get started." />
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Plate</th>
                <th>Type</th>
                <th>Owner</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v._id}>
                  <td className="font-medium text-slate-900">{v.year} {v.make} {v.model}<span className="ml-1.5 text-xs font-normal text-slate-400">{v.color}</span></td>
                  <td className="font-mono text-xs">{v.plateNumber}</td>
                  <td className="capitalize">{v.type}</td>
                  <td>{v.customer?.name}<span className="block text-xs text-slate-400">{v.customer?.phone}</span></td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(v)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Edit">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => setDeleteTarget(v)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" title="Delete">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit vehicle' : 'Add vehicle'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" form="vehicle-form" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save vehicle'}
            </button>
          </>
        }
      >
        <form id="vehicle-form" onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Owner</label>
            <CustomerPicker value={form.customer} onChange={(c) => setForm({ ...form, customer: c })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Make</label>
              <input required className="input" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} />
            </div>
            <div>
              <label className="label">Model</label>
              <input required className="input" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Year</label>
              <input type="number" className="input" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
            </div>
            <div>
              <label className="label">Color</label>
              <input className="input" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Plate number</label>
              <input required className="input" value={form.plateNumber} onChange={(e) => setForm({ ...form, plateNumber: e.target.value })} />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {vehicleTypes.map((t) => (
                  <option key={t} value={t} className="capitalize">{t}</option>
                ))}
              </select>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete vehicle"
        message={`Remove ${deleteTarget?.make} ${deleteTarget?.model} (${deleteTarget?.plateNumber})? This cannot be undone.`}
      />
    </div>
  )
}

export default Vehicles
