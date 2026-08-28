import {
  LayoutDashboard,
  CalendarClock,
  Users,
  Car,
  Sparkles,
  UserCog,
  Receipt,
  BarChart3,
  Settings,
  Waves,
  ListOrdered,
  LogOut,
  Users2,
} from 'lucide-react'

// Role-based wash-floor views (carwash-compile/01-foundation/dashboards.md):
// "My Queue" = Bay Attendant/Wash Technician home view, "Checkout" = Cashier home view
// (both open to any floor staff), "Wash Ops" = Site Manager's full bay board + order
// history (admin/manager only — RBAC also enforced server-side, see washOrderController).
export const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'staff'] },
  { to: '/floor', label: 'My Queue', icon: ListOrdered, roles: ['admin', 'manager', 'staff'] },
  { to: '/checkout', label: 'Checkout', icon: LogOut, roles: ['admin', 'manager', 'staff'] },
  { to: '/wash-queue', label: 'Wash Ops', icon: Waves, roles: ['admin', 'manager'] },
  { to: '/memberships', label: 'Memberships', icon: Users2, roles: ['admin', 'manager'] },
  { to: '/bookings', label: 'Bookings', icon: CalendarClock, roles: ['admin', 'manager', 'staff'] },
  { to: '/customers', label: 'Customers', icon: Users, roles: ['admin', 'manager', 'staff'] },
  { to: '/vehicles', label: 'Vehicles', icon: Car, roles: ['admin', 'manager', 'staff'] },
  { to: '/services', label: 'Services', icon: Sparkles, roles: ['admin', 'manager', 'staff'] },
  { to: '/staff', label: 'Staff', icon: UserCog, roles: ['admin', 'manager'] },
  { to: '/expenses', label: 'Expenses', icon: Receipt, roles: ['admin', 'manager'] },
  { to: '/reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'manager'] },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['admin', 'manager', 'staff'] },
]
