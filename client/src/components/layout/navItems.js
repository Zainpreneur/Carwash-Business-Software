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
  LifeBuoy,
  BriefcaseBusiness,
  Boxes,
  Building2,
} from 'lucide-react'

/**
 * The navigation of a business workspace.
 *
 * `minRole` is the *minimum* privilege needed (owner > admin > manager > staff).
 * `feature` is the plan flag that unlocks the page — a business on a plan
 * without it never sees the item in the sidebar and gets an upgrade prompt if
 * the URL is opened directly.
 */
export const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, minRole: 'staff' },
  { to: '/floor', label: 'My Queue', icon: ListOrdered, minRole: 'staff' },
  { to: '/checkout', label: 'Checkout', icon: LogOut, minRole: 'staff' },
  { to: '/wash-queue', label: 'Wash Ops', icon: Waves, minRole: 'manager' },
  { to: '/memberships', label: 'Memberships', icon: Users2, minRole: 'manager', feature: 'memberships' },
  { to: '/tickets', label: 'Support', icon: LifeBuoy, minRole: 'staff' },
  { to: '/bookings', label: 'Bookings', icon: CalendarClock, minRole: 'staff' },
  { to: '/customers', label: 'Customers', icon: Users, minRole: 'staff' },
  { to: '/vehicles', label: 'Vehicles', icon: Car, minRole: 'staff' },
  { to: '/services', label: 'Services', icon: Sparkles, minRole: 'staff' },
  { to: '/staff', label: 'Staff', icon: UserCog, minRole: 'manager' },
  { to: '/hr', label: 'HR', icon: BriefcaseBusiness, minRole: 'manager', feature: 'hr' },
  { to: '/inventory', label: 'Inventory', icon: Boxes, minRole: 'manager', feature: 'inventory' },
  { to: '/expenses', label: 'Expenses', icon: Receipt, minRole: 'manager' },
  { to: '/reports', label: 'Reports', icon: BarChart3, minRole: 'manager', feature: 'reports' },
  { to: '/business', label: 'Business', icon: Building2, minRole: 'admin' },
  { to: '/settings', label: 'My Profile', icon: Settings, minRole: 'staff' },
]
