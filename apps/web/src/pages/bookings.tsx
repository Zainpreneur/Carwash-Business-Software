import { Badge } from '@/components/ui/badge';
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
import { formatDateTime, formatMoney } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';

async function listBookings() {
  const res = await api.api.bookings.$get({ query: { page: '1', limit: '50' } });
  if (!res.ok) throw new Error('Failed to load bookings');
  return res.json();
}

const VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  pending: 'warning',
  confirmed: 'default',
  'in-progress': 'secondary',
  completed: 'success',
  cancelled: 'destructive',
};

export function BookingsPage() {
  const bookings = useQuery({ queryKey: ['bookings'], queryFn: listBookings });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bookings</CardTitle>
      </CardHeader>
      <CardContent>
        {bookings.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : bookings.data?.data?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.data.data.map((b) => (
                <TableRow key={b._id}>
                  <TableCell className="font-medium">{b.bookingNumber}</TableCell>
                  <TableCell>{formatDateTime(b.scheduledAt)}</TableCell>
                  <TableCell>
                    <Badge variant={VARIANT[b.status] ?? 'secondary'}>{b.status}</Badge>
                  </TableCell>
                  <TableCell className="capitalize">{b.paymentStatus}</TableCell>
                  <TableCell className="text-right">{formatMoney(b.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No bookings yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
