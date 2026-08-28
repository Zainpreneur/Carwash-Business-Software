import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'
import CustomerPicker from '../shared/CustomerPicker'
import VehiclePicker from '../shared/VehiclePicker'
import { membershipPlansApi, membershipSubscriptionsApi } from '../../api/resources'
import { getErrorMessage } from '../../api/client'

// Cashier "membership-signup shortcut" (01-foundation/dashboards.md) — the enroll-membership
// workflow's queue-entry equivalent. Redirects to Stripe Checkout when Stripe is connected;
// otherwise creates the subscription immediately as a local demo record.
const MembershipSignupModal = ({ open, onClose, onSaved }) => {
  const [customer, setCustomer] = useState(null)
  const [vehicleId, setVehicleId] = useState('')
  const [planId, setPlanId] = useState('')
  const [plans, setPlans] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    membershipPlansApi.list({ active: true }).then(setPlans)
  }, [open])

  useEffect(() => {
    if (!open) {
      setCustomer(null)
      setVehicleId('')
      setPlanId('')
    }
  }, [open])

  const submit = async (e) => {
    e.preventDefault()
    if (!customer) return toast.error('Select a customer')
    if (!vehicleId) return toast.error('Select a vehicle')
    if (!planId) return toast.error('Select a plan')

    setSaving(true)
    try {
      const result = await membershipSubscriptionsApi.create({
        customer: customer._id,
        vehicle: vehicleId,
        plan: planId,
        successUrl: `${window.location.origin}/checkout?membership=success`,
        cancelUrl: `${window.location.origin}/checkout?membership=cancelled`,
      })
      if (result.mode === 'stripe') {
        window.location.href = result.checkoutUrl
        return
      }
      toast.success('Membership created (demo mode — Stripe not connected, no real billing)')
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
      title="New membership"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" form="membership-form" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Sign up'}
          </button>
        </>
      }
    >
      <form id="membership-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Customer</label>
          <CustomerPicker value={customer} onChange={(c) => { setCustomer(c); setVehicleId('') }} />
        </div>
        <div>
          <label className="label">Vehicle</label>
          <VehiclePicker customerId={customer?._id} value={vehicleId} onChange={setVehicleId} />
        </div>
        <div>
          <label className="label">Plan</label>
          <div className="space-y-2">
            {plans.map((p) => (
              <label
                key={p._id}
                className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                  planId === p._id ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <input type="radio" name="plan" checked={planId === p._id} onChange={() => setPlanId(p._id)} />
                  {p.name}
                </span>
                <span className="font-medium text-slate-700">${p.monthlyPrice.toFixed(2)}/mo</span>
              </label>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  )
}

export default MembershipSignupModal
