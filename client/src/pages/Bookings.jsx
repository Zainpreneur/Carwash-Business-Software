import { useEffect, useState, useCallback } from 'react'
import { Plus, CalendarClock, Pencil, Trash2, Eye, LayoutList, CalendarDays } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { bookingsApi } from '../api/resources'
import { getErrorMessage } from '../api/client'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import BookingFormModal from '../components/bookings/BookingFormModal'
import BookingDetailModal from '../components/bookings/BookingDetailModal'
import BookingsCalendar from '../components/bookings/BookingsCalendar'
import { useAuth } from '../context/AuthContext'

const statusOptions = ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled']

const Bookings = () => {
  const { user } = useAuth()
  const canDelete = user?.role === 'admin' || user?.role === 'manager'
  const [data, setData] = useState({ data: [], total: 0, page: 1, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [date, setDate] = useState('')
  const [page, setPage] = useState(1)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [viewingId, setViewingId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [view, setView] = useState('table')

  const load = useCallback(() => {
    setLoading(true)
    bookingsApi
      .list({ status: status || undefined, date: date || undefined, page, limit: view === 'calendar' ? 100 : 10 })
      .then(setData)
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [status, date, page, view])

  useEffect(load, [load])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = async (b) => {
    const full = await bookingsApi.get(b._id)
    setEditing(full)
    setFormOpen(true)
  }

  const onSaved = () => {
    setFormOpen(false)
    load()
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await bookingsApi.remove(deleteTarget._id)
      toast.success('Booking deleted')
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
        <div className="flex flex-wrap gap-2">
          <select
            className="input w-auto"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All statuses</option>
            {statusOptions.map((s) => (
              <option key={s} value={s} className="capitalize">{s}</option>
            ))}
          </select>
          <input
            type="date"
            className="input w-auto"
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              setPage(1)
            }}
          />
          {(status || date) && (
            <button
              className="btn-ghost"
              onClick={() => {
                setStatus('')
                setDate('')
              }}
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-slate-200">
            <button
              onClick={() => setView('table')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium ${view === 'table' ? 'bg-brand-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
            >
              <LayoutList size={14} /> Table
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium ${view === 'calendar' ? 'bg-brand-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
            >
              <CalendarDays size={14} /> Calendar
            </button>
          </div>
          <button className="btn-primary shrink-0" onClick={openCreate}>
            <Plus size={16} /> New booking
          </button>
        </div>
      </div>

      {loading ? (
        <Spinner full />
      ) : view === 'calendar' ? (
        <BookingsCalendar bookings={data.data} />
      ) : data.data.length === 0 ? (
        <div className="card">
          <EmptyState icon={CalendarClock} title="No bookings found" message="Adjust your filters or create a new booking." />
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Booking #</th>
                <th>Customer</th>
                <th>Vehicle</th>
                <th>Scheduled</th>
                <th>Staff</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((b) => (
                <tr key={b._id}>
                  <td className="font-medium text-slate-900">{b.bookingNumber}</td>
                  <td>{b.customer?.name}</td>
                  <td>{b.vehicle ? `${b.vehicle.make} ${b.vehicle.model}` : '—'}</td>
                  <td className="whitespace-nowrap">{format(new Date(b.scheduledAt), 'MMM d, h:mm a')}</td>
                  <td>{b.assignedStaff?.name || '—'}</td>
                  <td>${Number(b.total).toFixed(2)}</td>
                  <td><Badge status={b.paymentStatus}>{b.paymentStatus}</Badge></td>
                  <td><Badge status={b.status}>{b.status}</Badge></td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setViewingId(b._id)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="View">
                        <Eye size={15} />
                      </button>
                      <button onClick={() => openEdit(b)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Edit">
                        <Pencil size={15} />
                      </button>
                      {canDelete && (
                        <button onClick={() => setDeleteTarget(b)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" title="Delete">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
        </div>
      )}

      <BookingFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={onSaved} editing={editing} />
      <BookingDetailModal bookingId={viewingId} onClose={() => setViewingId(null)} onChanged={load} />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete booking"
        message={`Permanently delete booking ${deleteTarget?.bookingNumber}?`}
      />
    </div>
  )
}

export default Bookings
