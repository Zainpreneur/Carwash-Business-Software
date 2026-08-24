import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Car, Phone, Mail, MapPin } from 'lucide-react'
import { customersApi } from '../../api/resources'
import Modal from '../ui/Modal'
import Spinner from '../ui/Spinner'
import Badge from '../ui/Badge'
import EmptyState from '../ui/EmptyState'

const CustomerDetail = ({ customerId, onClose }) => {
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!customerId) return
    setLoading(true)
    setCustomer(null)
    customersApi
      .get(customerId)
      .then(setCustomer)
      .finally(() => setLoading(false))
  }, [customerId])

  return (
    <Modal open={!!customerId} onClose={onClose} title="Customer profile" size="lg">
      {loading || !customer ? (
        <Spinner full />
      ) : (
        <div className="space-y-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{customer.name}</h3>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
              <span className="flex items-center gap-1"><Phone size={13} /> {customer.phone}</span>
              {customer.email && <span className="flex items-center gap-1"><Mail size={13} /> {customer.email}</span>}
              {customer.address && <span className="flex items-center gap-1"><MapPin size={13} /> {customer.address}</span>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-lg font-semibold text-slate-900">{customer.visitCount}</p>
              <p className="text-xs text-slate-500">Visits</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-lg font-semibold text-slate-900">${Number(customer.totalSpent || 0).toFixed(2)}</p>
              <p className="text-xs text-slate-500">Total spent</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-lg font-semibold text-slate-900">{customer.loyaltyPoints}</p>
              <p className="text-xs text-slate-500">Loyalty pts</p>
            </div>
          </div>

          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <Car size={15} /> Vehicles ({customer.vehicles?.length || 0})
            </h4>
            {customer.vehicles?.length ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {customer.vehicles.map((v) => (
                  <div key={v._id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <p className="font-medium text-slate-800">{v.year} {v.make} {v.model}</p>
                    <p className="text-xs text-slate-500">{v.plateNumber} · {v.color} · {v.type}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No vehicles on file.</p>
            )}
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-800">Recent bookings</h4>
            {customer.recentBookings?.length ? (
              <div className="space-y-2">
                {customer.recentBookings.map((b) => (
                  <div key={b._id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-slate-800">{b.bookingNumber}</p>
                      <p className="text-xs text-slate-500">{format(new Date(b.scheduledAt), 'MMM d, yyyy h:mm a')}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-slate-800">${Number(b.total).toFixed(2)}</p>
                      <Badge status={b.status}>{b.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No bookings yet" />
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

export default CustomerDetail
