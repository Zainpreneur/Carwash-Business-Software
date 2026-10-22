import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';

async function listCustomers() {
  const res = await api.api.customers.$get({ query: { page: '1', limit: '50' } });
  if (!res.ok) throw new Error('Failed to load customers');
  return res.json();
}

async function createCustomer(input: { name: string; phone: string; email?: string }) {
  const res = await api.api.customers.$post({ json: input });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? 'Failed to create customer');
  }
  return res.json();
}

export function CustomersPage() {
  const qc = useQueryClient();
  const customers = useQuery({ queryKey: ['customers'], queryFn: listCustomers });
  const create = useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      setForm({ name: '', phone: '', email: '' });
    },
  });

  const [form, setForm] = useState({ name: '', phone: '', email: '' });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({ name: form.name, phone: form.phone, email: form.email || undefined });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle>Customers</CardTitle>
        </CardHeader>
        <CardContent>
          {customers.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : customers.data?.data?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Visits</TableHead>
                  <TableHead className="text-right">Total spent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.data.data.map((c) => (
                  <TableRow key={c._id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.phone}</TableCell>
                    <TableCell>{c.visitCount}</TableCell>
                    <TableCell className="text-right">{formatMoney(c.totalSpent)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No customers yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add customer</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            {create.error && <p className="text-sm text-destructive">{create.error.message}</p>}
            <Button type="submit" className="w-full" disabled={create.isPending}>
              <Plus className="size-4" /> Add customer
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
