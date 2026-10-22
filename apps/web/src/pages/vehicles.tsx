import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';

async function listVehicles() {
  const res = await api.api.vehicles.$get({ query: { page: '1', limit: '50' } });
  if (!res.ok) throw new Error('Failed to load vehicles');
  return res.json();
}

export function VehiclesPage() {
  const vehicles = useQuery({ queryKey: ['vehicles'], queryFn: listVehicles });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vehicles</CardTitle>
      </CardHeader>
      <CardContent>
        {vehicles.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : vehicles.data?.data?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plate</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Last wash</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.data.data.map((v) => (
                <TableRow key={v._id}>
                  <TableCell className="font-medium">{v.plateNumber}</TableCell>
                  <TableCell>
                    {v.make} {v.model} {v.year ? `(${v.year})` : ''}
                  </TableCell>
                  <TableCell className="capitalize">{v.type}</TableCell>
                  <TableCell>{v.lastWashAt ? formatDateTime(v.lastWashAt) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No vehicles yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
