import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'
import CustomerPicker from '../shared/CustomerPicker'
import VehiclePicker from '../shared/VehiclePicker'
import { vehiclesApi, washPackagesApi, washOrdersApi } from '../../api/resources'
import { getErrorMessage } from '../../api/client'

// Maps this app's 6-value Vehicle.type onto the spec's 3-tier PackagePricing.vehicleType.
// Motorcycles/oversized rigs have no pricing row — quoted manually, per the spec's assumptions.
const TIER_FOR = { sedan: 'sedan-coupe', suv: 'suv-truck', truck: 'suv-truck', van: 'van-oversized' }

const emptyState = {
  customer: null,
  vehicleId: '',
  packageId: '',
  price: '',
  paymentMethod: 'cash',
  bookingType: 'walk-in',
  scheduledFor: '',
}

const WashOrderFormModal = ({ open, onClose, onSaved }) => {
  const [form, setForm] = useState(emptyState)
  const [packages, setPackages] = useState([])
  const [vehicle, setVehicle] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    washPackagesApi.list({ active: true }).then(setPackages)
  }, [open])

  useEffect(() => {
    if (!open) setForm(emptyState)
  }, [open])

  useEffect(() => {
    if (!form.vehicleId) {
      setVehicle(null)
      return
    }
    vehiclesApi.get(form.vehicleId).then(setVehicle)
  }, [form.vehicleId])

  const selectedPackage = packages.find((p) => p._id === form.packageId)
  const tier = vehicle ? TIER_FOR[vehicle.type] : null
  const suggestedPrice = selectedPackage && tier ? selectedPackage.pricing?.[tier] : undefined

  useEffect(() => {
    if (suggestedPrice !== undefined) setForm((f) => ({ ...f, price: suggestedPrice }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedPrice])

  const manualQuoteNeeded = useMemo(() => vehicle && !tier, [vehicle, tier])

  const submit = async (e) => {
    e.preventDefault()
    if (!form.vehicleId) return toast.error('Select a vehicle')
    if (!form.packageId) return toast.error('Select a wash package')
    if (form.price === '' || form.price === null) return toast.error('A price is required')
    if (form.bookingType === 'appointment' && !form.scheduledFor) return toast.error('Pick an appointment time')

    setSaving(true)
    try {
      await washOrdersApi.create({
        customer: form.customer?._id || null,
        vehicle: form.vehicleId,
        package: form.packageId,
        price: Number(form.price),
        paymentMethod: form.paymentMethod,
        bookingType: form.bookingType,
        scheduledFor: form.bookingType === 'appointment' ? new Date(form.scheduledFor).toISOString() : null,
      })
      toast.success('Vehicle logged into the queue')
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
      title="Log vehicle"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" form="wash-order-form" type="submit" disabled={saving}>
            {saving ? 'Logging…' : 'Add to queue'}
          </button>
        </>
      }
    >
      <form id="wash-order-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Customer</label>
          <CustomerPicker value={form.customer} onChange={(c) => setForm({ ...form, customer: c, vehicleId: '' })} />
        </div>
        <div>
          <label className="label">Vehicle</label>
          <VehiclePicker customerId={form.customer?._id} value={form.vehicleId} onChange={(vehicleId) => setForm({ ...form, vehicleId })} />
        </div>

        <div>
          <label className="label">Wash package</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {packages.map((p) => (
              <label
                key={p._id}
                className={`flex cursor-pointer flex-col rounded-lg border px-3 py-2 text-sm transition-colors ${
                  form.packageId === p._id ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <input type="radio" name="package" checked={form.packageId === p._id} onChange={() => setForm({ ...form, packageId: p._id })} />
                  <span className="font-medium text-slate-800">{p.name}</span>
                </span>
                <span className="ml-6 text-xs text-slate-500 capitalize">{p.deliveryLane.replace('-', ' ')} · ~{p.avgCycleTimeMinutes} min</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Price ($) {manualQuoteNeeded && <span className="text-amber-600">— manual quote</span>}</label>
            <input required type="number" min="0" step="0.01" className="input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <div>
            <label className="label">Payment method</label>
            <select className="input" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="membership">Membership</option>
              <option value="fleet-invoice">Fleet invoice</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Booking type</label>
            <select className="input" value={form.bookingType} onChange={(e) => setForm({ ...form, bookingType: e.target.value })}>
              <option value="walk-in">Walk-in</option>
              <option value="appointment">Appointment (detail bay)</option>
            </select>
          </div>
          {form.bookingType === 'appointment' && (
            <div>
              <label className="label">Scheduled for</label>
              <input type="datetime-local" required className="input" value={form.scheduledFor} onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })} />
            </div>
          )}
        </div>
      </form>
    </Modal>
  )
}

export default WashOrderFormModal
