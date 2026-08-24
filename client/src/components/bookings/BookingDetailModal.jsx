import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Car, User, Phone, Wrench, Clock } from 'lucide-react'
import Modal from '../ui/Modal'
import Badge from '../ui/Badge'
import Spinner from '../ui/Spinner'
import { bookingsApi } from '../../api/resources'
import { getErrorMessage } from '../../api/client'

const statuses = ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled']
const paymentStatuses = ['unpaid', 'paid', 'partial', 'refunded']

const BookingDetailModal = ({ bookingId, onClose, onChanged }) => {
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)

  const load = () => {
    if (!bookingId) return
    setLoading(true)
    bookingsApi
      .get(bookingId)
      .then(setBooking)
      .finally(() => setLoading(false))
  }

  useEffect(load, [bookingId])

  const changeStatus = async (status) => {
    setUpdating(true)
    try {
      await bookingsApi.updateStatus(bookingId, status)
      toast.success(`Marked as ${status}`)
      load()
      onChanged?.()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setUpdating(false)
    }
  }

  const changePayment = async (paymentStatus) => {
    setUpdating(true)
    try {
      await bookingsApi.updatePayment(bookingId, { paymentStatus })
      toast.success(`Payment marked ${paymentStatus}`)
      load()
      onChanged?.()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setUpdating(false)
    }
  }

  return (
    <Modal open={!!bookingId} onClose={onClose} title={booking ? booking.bookingNumber : 'Booking'} size="lg">
      {loading || !booking ? (
        <Spinner full />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge status={booking.status}>{booking.status}</Badge>
            <Badge status={booking.paymentStatus}>{booking.paymentStatus}</Badge>
            {booking.priority === 'high' && <Badge color="red">High priority</Badge>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-400"><User size={13} /> Customer</p>
              <p className="font-medium text-slate-800">{booking.customer?.name}</p>
              <p className="flex items-center gap-1 text-xs text-slate-500"><Phone size={12} /> {booking.customer?.phone}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-400"><Car size={13} /> Vehicle</p>
              <p className="font-medium text-slate-800">{booking.vehicle?.year} {booking.vehicle?.make} {booking.vehicle?.model}</p>
              <p className="text-xs text-slate-500">{booking.vehicle?.plateNumber}</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-400"><Clock size={13} /> Schedule</p>
            <p className="text-sm text-slate-700">{format(new Date(booking.scheduledAt), 'EEEE, MMM d, yyyy · h:mm a')}</p>
            {booking.assignedStaff && <p className="mt-1 text-xs text-slate-500">Assigned to {booking.assignedStaff.name}</p>}
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-400"><Wrench size={13} /> Services</p>
            <div className="space-y-1.5">
              {booking.services.map((s, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-slate-600">{s.name}</span>
                  <span className="font-medium text-slate-800">${s.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
              <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>${booking.subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-slate-500"><span>Discount</span><span>-${booking.discount.toFixed(2)}</span></div>
              <div className="flex justify-between text-slate-500"><span>Tax</span><span>${booking.tax.toFixed(2)}</span></div>
              <div className="flex justify-between text-base font-semibold text-slate-900"><span>Total</span><span>${booking.total.toFixed(2)}</span></div>
            </div>
          </div>

          {booking.notes && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{booking.notes}</div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Update status</label>
              <select disabled={updating} className="input" value={booking.status} onChange={(e) => changeStatus(e.target.value)}>
                {statuses.map((s) => (
                  <option key={s} value={s} className="capitalize">{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Update payment</label>
              <select disabled={updating} className="input" value={booking.paymentStatus} onChange={(e) => changePayment(e.target.value)}>
                {paymentStatuses.map((s) => (
                  <option key={s} value={s} className="capitalize">{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default BookingDetailModal
