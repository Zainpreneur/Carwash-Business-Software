import { useMemo, useState } from 'react'
import { format, startOfMonth, startOfWeek, addDays, addMonths, isSameDay, isSameMonth, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Badge from '../ui/Badge'

const statusDots = {
  pending: 'bg-amber-400',
  confirmed: 'bg-sky-500',
  'in-progress': 'bg-indigo-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-slate-300',
}

const BookingsCalendar = ({ bookings }) => {
  const [cursor, setCursor] = useState(new Date())
  const [selected, setSelected] = useState(null)

  const gridStart = useMemo(() => startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 }), [cursor])
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart])

  const byDay = useMemo(() => {
    const map = new Map()
    for (const b of bookings) {
      const key = format(new Date(b.scheduledAt), 'yyyy-MM-dd')
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(b)
    }
    return map
  }, [bookings])

  const selectedBookings = selected ? byDay.get(format(selected, 'yyyy-MM-dd')) || [] : []

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold capitalize text-slate-800">{format(cursor, 'MMMM yyyy')}</h2>
        <div className="flex gap-1">
          <button onClick={() => setCursor((c) => addMonths(c, -1))} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setCursor(new Date())} className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100">
            Today
          </button>
          <button onClick={() => setCursor((c) => addMonths(c, 1))} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 text-center">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="bg-slate-50 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const dayBookings = byDay.get(format(day, 'yyyy-MM-dd')) || []
          const outside = !isSameMonth(day, cursor)
          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelected(isSameDay(selected || day, day) ? null : day)}
              className={`min-h-[64px] bg-white p-1 text-left align-top transition-colors hover:bg-brand-50/60 sm:min-h-[80px] ${
                selected && isSameDay(day, selected) ? 'ring-2 ring-inset ring-brand-400' : ''
              }`}
            >
              <span
                className={`text-xs font-medium ${
                  outside ? 'text-slate-300' : isToday(day) ? 'flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white' : 'text-slate-600'
                }`}
              >
                {format(day, 'd')}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayBookings.slice(0, 2).map((b) => (
                  <div key={b._id} className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] leading-tight text-slate-600" style={{ backgroundColor: '#f1f5f9' }}>
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDots[b.status] || 'bg-slate-300'}`} />
                    <span className="truncate">{b.customer?.name}</span>
                  </div>
                ))}
                {dayBookings.length > 2 && (
                  <div className="pl-1 text-[10px] font-medium text-brand-600">+{dayBookings.length - 2} more</div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="mt-3 rounded-lg border border-slate-200">
          <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {format(selected, 'EEEE, MMM d')} — {selectedBookings.length} booking{selectedBookings.length === 1 ? '' : 's'}
          </p>
          {selectedBookings.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-slate-400">No bookings this day</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {selectedBookings.map((b) => (
                <li key={b._id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  <span className="font-medium text-slate-800">{format(new Date(b.scheduledAt), 'h:mm a')}</span>
                  <span className="text-slate-600">{b.customer?.name}</span>
                  <span className="text-xs text-slate-400">{b.vehicle ? `${b.vehicle.make} ${b.vehicle.model}` : ''}</span>
                  <span className="ml-auto font-medium text-slate-700">${Number(b.total).toFixed(2)}</span>
                  <Badge status={b.status}>{b.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default BookingsCalendar
