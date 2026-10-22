import { AppLayout } from '@/components/layout';
import { BookingsPage } from '@/pages/bookings';
import { CustomersPage } from '@/pages/customers';
import { DashboardPage } from '@/pages/dashboard';
import { LoginPage } from '@/pages/login';
import { SettingsPage } from '@/pages/settings';
import { TicketsPage } from '@/pages/tickets';
import { VehiclesPage } from '@/pages/vehicles';
import { WashFloorPage } from '@/pages/wash-floor';
import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

/** Pathless layout route: all children render inside the sidebar layout. */
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_app',
  component: AppLayout,
  beforeLoad: async () => {
    const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/auth/get-session`, {
      credentials: 'include',
    });
    const data = res.ok ? ((await res.json()) as { user?: unknown } | null) : null;
    if (!data?.user) throw redirect({ to: '/login' });
  },
});

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  component: DashboardPage,
});
const washFloorRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/wash-floor',
  component: WashFloorPage,
});
const bookingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/bookings',
  component: BookingsPage,
});
const customersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/customers',
  component: CustomersPage,
});
const vehiclesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/vehicles',
  component: VehiclesPage,
});
const ticketsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/tickets',
  component: TicketsPage,
});
const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/settings',
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren([
    dashboardRoute,
    washFloorRoute,
    bookingsRoute,
    customersRoute,
    vehiclesRoute,
    ticketsRoute,
    settingsRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
