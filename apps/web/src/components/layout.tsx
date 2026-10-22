import { getTenantSlug, setTenantSlug } from '@/lib/api';
import { useMyTenants, useOnboard, useSession, useSignOut } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { Link, Outlet, useNavigate } from '@tanstack/react-router';
import {
  CalendarDays,
  Car,
  Droplets,
  LayoutDashboard,
  LogOut,
  Settings,
  Ticket,
  Users,
} from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input, Label } from './ui/input';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/wash-floor', label: 'Wash Floor', icon: Droplets },
  { to: '/bookings', label: 'Bookings', icon: CalendarDays },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/vehicles', label: 'Vehicles', icon: Car },
  { to: '/tickets', label: 'Support', icon: Ticket },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const;

export function AppLayout() {
  const { data: session } = useSession();
  const memberships = useMyTenants();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [slug, setSlug] = useState<string | null>(() => getTenantSlug());

  const list = memberships.data ?? [];

  // Pick a business after login (or repair a stale slug left in localStorage).
  useEffect(() => {
    if (!list.length) return;
    const stored = getTenantSlug();
    const next = list.some((m) => m.slug === stored) ? stored! : list[0].slug;
    if (next !== stored) setTenantSlug(next);
    if (next !== slug) setSlug(next);
  }, [list, slug]);

  function handleSignOut() {
    signOut.mutate(undefined, { onSuccess: () => navigate({ to: '/login' }) });
  }

  function switchTenant(next: string) {
    setTenantSlug(next);
    setSlug(next);
    // Refetch tenant-scoped data with the new X-Tenant-Slug header.
    qc.invalidateQueries({
      predicate: (query) => !['session', 'my-tenants'].includes(String(query.queryKey[0])),
    });
  }

  if (memberships.isLoading) return <Gate>Loading your businesses…</Gate>;
  if (memberships.isError) return <Gate>Could not load your businesses. Please refresh.</Gate>;
  if (!list.length)
    return (
      <NoBusiness
        email={session?.user?.email}
        onSignOut={handleSignOut}
        pending={signOut.isPending}
      />
    );

  const active = list.find((m) => m.slug === slug);
  if (!active) return <Gate>Preparing your workspace…</Gate>;

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-background md:flex">
        <div className="flex h-14 items-center gap-2 border-b px-5">
          <Droplets className="size-5 text-primary" />
          <span className="font-semibold">Carwash SaaS</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === '/' }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              activeProps={{ className: cn('bg-accent text-accent-foreground') }}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t p-3">
          <div className="mb-2 px-2">
            <p className="truncate text-sm font-medium">{session?.user?.name ?? 'Guest'}</p>
            <p className="truncate text-xs text-muted-foreground">{session?.user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={handleSignOut}
            disabled={signOut.isPending}
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b bg-background px-5">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="hidden text-sm font-semibold text-muted-foreground sm:block">
              Operations
            </h1>
            <select
              aria-label="Active business"
              value={active.slug}
              onChange={(e) => switchTenant(e.target.value)}
              className="h-8 max-w-56 rounded-md border border-input bg-background px-2 text-sm"
            >
              {list.map((m) => (
                <option key={m._id} value={m.slug}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <span className="hidden text-xs text-muted-foreground sm:block">
            {session?.user ? `Signed in as ${session.user.email}` : 'Not signed in'}
          </span>
        </header>
        <main className="flex-1 p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Gate({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function NoBusiness({
  email,
  onSignOut,
  pending,
}: {
  email?: string;
  onSignOut: () => void;
  pending: boolean;
}) {
  const onboard = useOnboard();
  const [businessName, setBusinessName] = useState('');

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your business</CardTitle>
          <CardDescription>
            {email ? `Signed in as ${email}. ` : ''}
            You are not connected to a car wash yet. Create one to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onboard.mutate({ businessName });
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="onboard-business-name">Business name</Label>
              <Input
                id="onboard-business-name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Springfield Car Wash"
                required
              />
            </div>
            {onboard.error && <p className="text-sm text-destructive">{onboard.error.message}</p>}
            <Button type="submit" className="w-full" disabled={onboard.isPending}>
              {onboard.isPending ? 'Creating…' : 'Create business'}
            </Button>
          </form>
          <Button variant="ghost" className="mt-2 w-full" onClick={onSignOut} disabled={pending}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
