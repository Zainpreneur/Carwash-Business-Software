import { useState } from 'react'
import { Menu, LogOut, ChevronDown, User as UserIcon, ScanLine, MapPin, Building2, Bell, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTenant } from '../../context/TenantContext'
import NotificationsBell from './NotificationsBell'
import PlateScanner from '../shared/PlateScanner'

const Topbar = ({ onMenuClick, title }) => {
  const { user, logout } = useAuth()
  const { tenant, locations, locationId, setLocationId, tenantPath } = useTenant()
  const [menuOpen, setMenuOpen] = useState(false)
  const [branchOpen, setBranchOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const navigate = useNavigate()

  const initials = (user?.name || '?')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const activeBranch = locations.find((l) => l.id === locationId)

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-xl sm:px-6">
      <button
        onClick={onMenuClick}
        className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 lg:hidden"
      >
        <Menu size={20} />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">{title}</h1>
        {tenant?.name && (
          <p className="hidden truncate text-[11px] leading-tight text-slate-500 sm:block">
            {tenant.name}
            {activeBranch ? ` · ${activeBranch.name}` : ''}
          </p>
        )}
      </div>

      {/* Branch switcher */}
      {locations.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setBranchOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100"
            title="Active branch"
          >
            <MapPin size={14} className="text-slate-400" />
            <span className="hidden max-w-[10rem] truncate sm:inline">
              {activeBranch?.name || 'All branches'}
            </span>
            <ChevronDown size={13} className="text-slate-400" />
          </button>
          {branchOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setBranchOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                <button
                  onClick={() => {
                    setLocationId('')
                    setBranchOpen(false)
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Building2 size={14} className="text-slate-400" />
                  All branches
                </button>
                {locations.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => {
                      setLocationId(l.id)
                      setBranchOpen(false)
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <MapPin size={14} className="text-slate-400" />
                    <span className="min-w-0 flex-1 truncate">{l.name}</span>
                    {l.id === locationId && (
                      <span className="h-2 w-2 rounded-full bg-brand-600" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Scan plate */}
      <button
        onClick={() => setScanOpen(true)}
        className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:bg-slate-700 hover:shadow-md"
        title="Scan a number plate"
      >
        <ScanLine size={15} />
        <span className="hidden sm:inline">Scan plate</span>
      </button>

      <NotificationsBell />

      {/* Profile menu */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-slate-100"
        >
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm ring-2 ring-white"
            style={{ backgroundColor: user?.avatarColor || tenant?.brandColor || '#0284c7' }}
          >
            {initials}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-medium leading-tight text-slate-800">{user?.name}</span>
            <span className="block text-[11px] capitalize leading-tight text-slate-500">
              {user?.role || 'member'}
            </span>
          </span>
          <ChevronDown size={14} className="hidden text-slate-400 sm:block" />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
              <div className="border-b border-slate-100 px-3.5 py-3">
                <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
              </div>
              <button
                onClick={() => {
                  setMenuOpen(false)
                  navigate(tenantPath('/settings'))
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
              >
                <UserIcon size={15} className="text-slate-400" /> My Profile
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false)
                  navigate(tenantPath('/business'))
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Building2 size={15} className="text-slate-400" /> Business Settings
              </button>
              <div className="border-t border-slate-100" />
              <button
                onClick={() => {
                  setMenuOpen(false)
                  logout()
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-rose-600 transition-colors hover:bg-rose-50"
              >
                <LogOut size={15} /> Sign out
              </button>
            </div>
          </>
        )}
      </div>

      <PlateScanner open={scanOpen} onClose={() => setScanOpen(false)} />
    </header>
  )
}

export default Topbar
