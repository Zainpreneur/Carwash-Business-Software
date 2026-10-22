import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { navItems } from './navItems'
import { useTenant } from '../../context/TenantContext'

const DashboardLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const { tenant } = useTenant()

  const relativePath = location.pathname.replace(/^\/t\/[^/]+/, '') || '/'

  const current = navItems.find((item) =>
    item.to === '/' ? relativePath === '/' : relativePath.startsWith(item.to)
  )

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50">
      {/* Subtle background pattern */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.015]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, #000 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileOpen(true)} title={current?.label || tenant?.name || 'SudsFlow'} />
        <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          <div className="mx-auto max-w-7xl animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout
