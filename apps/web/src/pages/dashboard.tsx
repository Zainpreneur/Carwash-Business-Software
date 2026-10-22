import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';

async function fetchSummary() {
  const res = await api.api.dashboard.summary.$get();
  if (!res.ok) throw new Error('Failed to load dashboard');
  return res.json();
}

async function fetchRecent() {
  const res = await api.api.dashboard['recent-orders'].$get();
  if (!res.ok) throw new Error('Failed to load recent orders');
  return res.json();
}

export function DashboardPage() {
  const summary = useQuery({ queryKey: ['dashboard', 'summary'], queryFn: fetchSummary });
  const recent = useQuery({ queryKey: ['dashboard', 'recent'], queryFn: fetchRecent });

  const s = summary.data?.data;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Today at a glance</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Today's revenue" value={formatMoney(s?.today.revenue ?? 0)} />
        <Stat label="Washes today" value={String(s?.today.orders ?? 0)} />
        <Stat label="Active memberships" value={String(s?.activeMemberships ?? 0)} />
        <Stat label="Open tickets" value={String(s?.openTickets ?? 0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent wash orders</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : recent.data?.data?.length ? (
              <ul className="divide-y">
                {recent.data.data.map((order) => (
                  <li key={order._id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium">{order.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">{order.status}</p>
                    </div>
                    <span className="font-medium">{formatMoney(order.price)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No wash orders yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Low stock</CardTitle>
          </CardHeader>
          <CardContent>
            {s?.lowStock.length ? (
              <ul className="divide-y">
                {s.lowStock.map((item) => (
                  <li key={item.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{item.name}</span>
                    <span className="text-muted-foreground">
                      {item.quantityOnHand} {item.unit}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Stock levels look healthy.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
