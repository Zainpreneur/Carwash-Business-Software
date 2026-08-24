import { useEffect, useRef, useState, useCallback } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { notificationsApi } from '../../api/resources'
import { useAuth } from '../../context/AuthContext'

const typeStyles = {
  booking_created: 'bg-sky-100 text-sky-700',
  booking_completed: 'bg-emerald-100 text-emerald-700',
  booking_status: 'bg-amber-100 text-amber-700',
  info: 'bg-slate-100 text-slate-600',
}

const NotificationsBell = () => {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const timer = useRef(null)

  const poll = useCallback(() => {
    if (!user) return
    notificationsApi.unreadCount().then((r) => setUnread(r.count)).catch(() => {})
  }, [user])

  useEffect(() => {
    poll()
    timer.current = setInterval(poll, 30000)
    return () => clearInterval(timer.current)
  }, [poll])

  const openPanel = () => {
    setOpen((o) => !o)
    if (!open) {
      notificationsApi
        .list()
        .then(setItems)
        .catch(() => {})
    }
  }

  const markAll = async () => {
    try {
      await notificationsApi.markAllRead()
      setUnread(0)
      setItems((list) => list.map((n) => ({ ...n, read: true })))
    } catch {
      /* ignore */
    }
  }

  const markOne = async (n) => {
    if (n.read) return
    try {
      await notificationsApi.markRead(n._id)
      setItems((list) => list.map((x) => (x._id === n._id ? { ...x, read: true } : x)))
      setUnread((c) => Math.max(0, c - 1))
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="relative">
      <button
        onClick={openPanel}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
        title="Notifications"
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <span className="text-sm font-semibold text-slate-800">Notifications</span>
              <button onClick={markAll} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
                <CheckCheck size={13} /> Mark all read
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-400">No notifications yet</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n._id}
                    onClick={() => markOne(n)}
                    className={`flex w-full flex-col gap-1 border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50 ${n.read ? '' : 'bg-brand-50/40'}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${typeStyles[n.type] || typeStyles.info}`}>
                        {(n.type || 'info').replace('_', ' ')}
                      </span>
                      {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                    </span>
                    <span className="text-sm font-medium text-slate-800">{n.title}</span>
                    <span className="text-xs leading-snug text-slate-500">{n.message}</span>
                    <span className="text-[11px] text-slate-400">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default NotificationsBell
