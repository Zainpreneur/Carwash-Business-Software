import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

async function fetchTenant() {
  const res = await api.api.tenant.$get();
  if (!res.ok) throw new Error('Failed to load business');
  return res.json();
}

async function fetchLocations() {
  const res = await api.api.tenant.locations.$get();
  if (!res.ok) throw new Error('Failed to load locations');
  return res.json();
}

export function SettingsPage() {
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: fetchTenant });
  const locations = useQuery({ queryKey: ['locations'], queryFn: fetchLocations });
  const t = tenant.data?.data;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Business</CardTitle>
          <CardDescription>Your car wash profile</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Name" value={t?.name ?? '—'} />
          <Row label="Slug" value={t?.slug ?? '—'} />
          <Row label="Plan" value={t?.plan ?? '—'} />
          <Row label="Status" value={t?.status ?? '—'} />
          <Row label="Currency" value={t?.currency ?? '—'} />
          <Row label="Timezone" value={t?.timezone ?? '—'} />
          <Row label="Your role" value={t?.role ?? '—'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Locations</CardTitle>
          <CardDescription>Branches and sites</CardDescription>
        </CardHeader>
        <CardContent>
          {locations.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : locations.data?.data?.length ? (
            <ul className="divide-y text-sm">
              {locations.data.data.map((l) => (
                <li key={l._id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">{l.name}</p>
                    <p className="text-xs text-muted-foreground">Code: {l.code}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {l.active ? 'Active' : 'Inactive'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No locations yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  );
}
