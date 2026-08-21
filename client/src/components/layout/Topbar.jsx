import { useState } from 'react'
import { Menu, LogOut, ChevronDown, User as UserIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const Topbar = ({ onMenuClick, title }) => {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  const initials = (user?.name || '?')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
      <button onClick={onMenuClick} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden">
        <Menu size={20} />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-slate-900 sm:text-lg">{title}</h1>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100"
        >
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: user?.avatarColor || '#0284c7' }}
          >
            {initials}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-medium leading-tight text-slate-800">{user?.name}</span>
            <span className="block text-[11px] capitalize leading-tight text-slate-500">{user?.role}</span>
          </span>
          <ChevronDown size={14} className="hidden text-slate-400 sm:block" />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              <button
                onClick={() => {
                  setMenuOpen(false)
                  navigate('/settings')
                }}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <UserIcon size={15} /> Profile & Settings
              </button>
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-sm text-rose-600 hover:bg-rose-50"
              >
                <LogOut size={15} /> Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}

export default Topbar
