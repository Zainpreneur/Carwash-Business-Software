import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'
import CustomerPicker from '../shared/CustomerPicker'
import VehiclePicker from '../shared/VehiclePicker'
import { servicesApi, usersApi, bookingsApi } from '../../api/resources'
import { getErrorMessage } from '../../api/client'

const toLocalInput = (date) => {
  const d = date ? new Date(date) : new Date(Date.now() + 60 * 60 * 1000)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}

const emptyState = {
  customer: null,
  vehicleId: '',
  serviceIds: [],
  assignedStaff: '',
  scheduledAt: toLocalInput(),
  discount: 0,
  taxRate: 5,
  priority: 'normal',
  notes: '',
}

const BookingFormModal = ({ open, onClose, onSaved, editing }) => {
  const [form, setForm] = useState(emptyState)
  const [services, setServices] = useState([])
  const [staff, setStaff] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    servicesApi.list({ active: true }).then(setServices)
    usersApi.list().then((users) => setStaff(users.filter((u) => u.active)))
  }, [open])

  useEffect(() => {
    if (!open) return
    if (editing) {
      setForm({
        customer: editing.customer,
        vehicleId: editing.vehicle?._id,
        serviceIds: editing.services.map((s) => s.service),
        assignedStaff: editing.assignedStaff?._id || '',
        scheduledAt: toLocalInput(editing.scheduledAt),
        discount: editing.discount || 0,
        taxRate: 0,
        priority: editing.priority || 'normal',
        notes: editing.notes || '',
      })
    } else {
      setForm(emptyState)
    }
  }, [editing, open])

  const toggleService = (id) => {
    setForm((f) => ({
      ...f,
      serviceIds: f.serviceIds.includes(id) ? f.serviceIds.filter((s) => s !== id) : [...f.serviceIds, id],
    }))
  }

  const selectedServices = services.filter((s) => form.serviceIds.includes(s._id))
  const subtotal = selectedServices.reduce((sum, s) => sum + s.price, 0)
  const discounted = Math.max(subtotal - Number(form.discount || 0), 0)
  const tax = Math.round(discounted * (Number(form.taxRate || 0) / 100) * 100) / 100
  const total = Math.round((discounted + tax) * 100) / 100

  const submit = async (e) => {
    e.preventDefault()
    if (!form.customer) return toast.error('Please select a customer')
    if (!form.vehicleId) return toast.error('Please select a vehicle')
    if (form.serviceIds.length === 0) return toast.error('Select at least one service')

    setSaving(true)
    try {
      const payload = {
        customer: form.customer._id,
        vehicle: form.vehicleId,
        serviceIds: form.serviceIds,
        assignedStaff: form.assignedStaff || undefined,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        discount: Number(form.discount || 0),
        taxRate: Number(form.taxRate || 0),
        priority: form.priority,
        notes: form.notes,
      }
      if (editing) {
        await bookingsApi.update(editing._id, payload)
        toast.success('Booking updated')
      } else {
        await bookingsApi.create(payload)
        toast.success('Booking created')
      }
      onSaved()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${editing.bookingNumber}` : 'New booking'}
      size="xl"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" form="booking-form" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save booking'}
          </button>
        </>
      }
    >
      <form id="booking-form" onSubmit={submit} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Customer</label>
            <CustomerPicker value={form.customer} onChange={(c) => setForm({ ...form, customer: c, vehicleId: '' })} />
          </div>
          <div>
            <label className="label">Vehicle</label>
            <VehiclePicker customerId={form.customer?._id} value={form.vehicleId} onChange={(vehicleId) => setForm({ ...form, vehicleId })} />
          </div>
        </div>

        <div>
          <label className="label">Services</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {services.map((s) => (
              <label
                key={s._id}
                className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                  form.serviceIds.includes(s._id) ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={form.serviceIds.includes(s._id)} onChange={() => toggleService(s._id)} />
                  {s.name}
                </span>
                <span className="font-medium text-slate-700">${s.price.toFixed(2)}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Assign staff</label>
            <select className="input" value={form.assignedStaff} onChange={(e) => setForm({ ...form, assignedStaff: e.target.value })}>
              <option value="">Unassigned</option>
              {staff.map((u) => (
                <option key={u._id} value={u._id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Scheduled at</label>
            <input type="datetime-local" required className="input" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Discount ($)</label>
            <input type="number" min="0" step="0.01" className="input" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
          </div>
          <div>
            <label className="label">Tax rate (%)</label>
            <input type="number" min="0" step="0.1" className="input" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} />
          </div>
          <div>
            <label className="label">Priority</label>
            <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea rows={2} className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>

        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-slate-500"><span>Discount</span><span>-${Number(form.discount || 0).toFixed(2)}</span></div>
          <div className="flex justify-between text-slate-500"><span>Tax</span><span>${tax.toFixed(2)}</span></div>
          <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-800"><span>Total</span><span>${total.toFixed(2)}</span></div>
        </div>
      </form>
    </Modal>
  )
}

export default BookingFormModal
