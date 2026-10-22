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
import { formatDateTime } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';

async function listTickets() {
  const res = await api.api.tickets.$get({ query: { page: '1', limit: '50' } });
  if (!res.ok) throw new Error('Failed to load tickets');
  return res.json();
}

export function TicketsPage() {
  const tickets = useQuery({ queryKey: ['tickets'], queryFn: listTickets });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Support tickets</CardTitle>
      </CardHeader>
      <CardContent>
        {tickets.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : tickets.data?.data?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.data.data.map((t) => (
                <TableRow key={t._id}>
                  <TableCell className="font-medium">{t.subject}</TableCell>
                  <TableCell className="capitalize">{t.category.replaceAll('-', ' ')}</TableCell>
                  <TableCell className="capitalize">{t.priority}</TableCell>
                  <TableCell>
                    <Badge variant={t.status === 'open' ? 'warning' : 'secondary'}>
                      {t.status.replaceAll('-', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDateTime(t.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No tickets yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
