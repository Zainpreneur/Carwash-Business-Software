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
} from 'lucide-react'

export const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'staff'] },
  { to: '/bookings', label: 'Bookings', icon: CalendarClock, roles: ['admin', 'manager', 'staff'] },
  { to: '/customers', label: 'Customers', icon: Users, roles: ['admin', 'manager', 'staff'] },
  { to: '/vehicles', label: 'Vehicles', icon: Car, roles: ['admin', 'manager', 'staff'] },
  { to: '/services', label: 'Services', icon: Sparkles, roles: ['admin', 'manager', 'staff'] },
  { to: '/staff', label: 'Staff', icon: UserCog, roles: ['admin', 'manager'] },
  { to: '/expenses', label: 'Expenses', icon: Receipt, roles: ['admin', 'manager'] },
  { to: '/reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'manager'] },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['admin', 'manager', 'staff'] },
]
