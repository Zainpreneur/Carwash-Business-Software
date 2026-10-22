import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Droplets, X, ChevronsUpDown, Building2, Check, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import { navItems } from './navItems'
import { useAuth } from '../../context/AuthContext'
import { useTenant } from '../../context/TenantContext'

const Sidebar = ({ mobileOpen, onClose }) => {
  const { user, tenants, switchTenant } = useAuth()
  const { tenant, can, hasFeature, tenantPath } = useTenant()
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const navigate = useNavigate()

  const visibleItems = navItems.filter(
    (item) => can(item.minRole) && hasFeature(item.feature)
  )

  const brandColor = tenant?.brandColor || '#0284c7'

  const content = (
    <div className="flex h-full flex-col">
      {/* Brand header */}
      <div className="flex items-center gap-3 px-5 py-5">
        {tenant?.logoUrl ? (
          <img
            src={tenant.logoUrl}
            alt={tenant.name}
            className="h-9 w-9 shrink-0 rounded-xl object-cover shadow-sm ring-1 ring-slate-200"
          />
        ) : (
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-md"
            style={{ backgroundColor: brandColor, boxShadow: `0 4px 12px ${brandColor}40` }}
          >
            <Droplets size={18} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-tight text-slate-900">
            {tenant?.name || 'SudsFlow'}
          </p>
          <p className="truncate text-[11px] leading-tight text-slate-500">
            {tenant?.plan?.name ? `${tenant.plan.name} plan` : 'Car Wash Manager'}
          </p>
        </div>
        <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden">
          <X size={18} />
        </button>
      </div>

      {/* Business switcher */}
      {tenants.length > 1 && (
        <div className="relative px-3 pb-3">
          <button
            onClick={() => setSwitcherOpen((o) => !o)}
            className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-left text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100"
          >
            <Building2 size={14} className="shrink-0 text-slate-400" />
            <span className="min-w-0 flex-1 truncate">{tenant?.name || 'Switch business'}</span>
            <ChevronsUpDown size={13} className="shrink-0 text-slate-400" />
          </button>
          {switcherOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setSwitcherOpen(false)} />
              <div className="absolute left-3 right-3 z-20 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                {tenants.map((t) => (
                  <button
                    key={t._id}
                    onClick={async () => {
                      setSwitcherOpen(false)
                      onClose?.()
                      if (t.slug === tenant?.slug) return
                      await switchTenant(t.slug)
                      navigate(`/t/${t.slug}`)
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white"
                      style={{ backgroundColor: t.brandColor || '#0284c7' }}
                    />
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    {t.slug === tenant?.slug && <Check size={14} className="text-brand-600" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={tenantPath(item.to)}
            end={item.to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              clsx(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-brand-50 text-brand-700 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  size={18}
                  className={clsx(
                    'shrink-0 transition-colors',
                    isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'
                  )}
                />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight size={14} className="text-brand-400" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-100 px-4 py-4">
        <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: user?.avatarColor || brandColor }}
          >
            {(user?.name || '?')
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-800">{user?.name}</p>
            <p className="truncate text-[10px] capitalize text-slate-500">{user?.role}</p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
        {content}
      </aside>

      {/* Mobile drawer */}
      <div
        className={clsx(
          'fixed inset-0 z-40 lg:hidden',
          mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'
        )}
      >
        <div
          className={clsx(
            'absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-200',
            mobileOpen ? 'opacity-100' : 'opacity-0'
          )}
          onClick={onClose}
        />
        <aside
          className={clsx(
            'absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl transition-transform duration-300 ease-out',
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
