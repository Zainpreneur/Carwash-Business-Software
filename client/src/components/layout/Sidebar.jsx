import { NavLink } from 'react-router-dom'
import { Droplets, X } from 'lucide-react'
import clsx from 'clsx'
import { navItems } from './navItems'
import { useAuth } from '../../context/AuthContext'

const Sidebar = ({ mobileOpen, onClose }) => {
  const { user } = useAuth()
  const visibleItems = navItems.filter((item) => item.roles.includes(user?.role))

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
          <Droplets size={20} />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight text-slate-900">SudsFlow</p>
          <p className="text-[11px] leading-tight text-slate-500">Car Wash Manager</p>
        </div>
        <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden">
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )
            }
          >
            <item.icon size={18} className="shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-100 px-4 py-4">
        <p className="text-[11px] text-slate-400">SudsFlow &copy; {new Date().getFullYear()}</p>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">{content}</aside>

      {/* Mobile drawer */}
      <div
        className={clsx(
          'fixed inset-0 z-40 lg:hidden',
          mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'
        )}
      >
        <div
          className={clsx(
            'absolute inset-0 bg-slate-900/50 transition-opacity',
            mobileOpen ? 'opacity-100' : 'opacity-0'
          )}
          onClick={onClose}
        />
        <aside
          className={clsx(
            'absolute inset-y-0 left-0 w-72 max-w-[80vw] bg-white shadow-xl transition-transform duration-200',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {content}
        </aside>
      </div>
    </>
  )
}

export default Sidebar
