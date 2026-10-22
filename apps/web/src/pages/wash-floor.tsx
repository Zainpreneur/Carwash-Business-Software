import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/utils';
import { WASH_ORDER_STATUSES, type WashOrderStatus } from '@carwash/shared/constants';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface WashOrder {
  _id: string;
  orderNumber: string;
  status: WashOrderStatus;
  price: number;
  vehicle: string;
  queuedAt: string;
}

async function fetchBoard(): Promise<Record<string, WashOrder[]>> {
  const res = await api.api['wash-orders'].board.$get();
  if (!res.ok) throw new Error('Failed to load wash floor');
  const body = (await res.json()) as { data: Record<string, WashOrder[]> };
  return body.data;
}

async function transition(input: { id: string; status: WashOrderStatus }) {
  const res = await api.api['wash-orders'][':id'].transition.$post({
    param: { id: input.id },
    json: { status: input.status },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? 'Transition failed');
  }
  return res.json();
}

const NEXT: Partial<Record<WashOrderStatus, WashOrderStatus[]>> = {
  queued: ['bay-assigned', 'cancelled'],
  'bay-assigned': ['in-wash', 'cancelled'],
  'in-wash': ['quality-check'],
  'quality-check': ['ready-for-pickup', 'in-wash'],
  'ready-for-pickup': ['completed'],
};

export function WashFloorPage() {
  const qc = useQueryClient();
  const board = useQuery({
    queryKey: ['wash-floor'],
    queryFn: fetchBoard,
    refetchInterval: 10_000,
  });
  const move = useMutation({
    mutationFn: transition,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wash-floor'] }),
  });

  const columns = WASH_ORDER_STATUSES.filter((s) => s !== 'cancelled');

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Wash floor</h2>
        <p className="text-sm text-muted-foreground">Live queue — refreshes every 10 seconds</p>
      </div>

      {move.error && <p className="text-sm text-destructive">{move.error.message}</p>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {columns.map((status) => {
          const orders = board.data?.[status] ?? [];
          return (
            <Card key={status}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="capitalize">{status.replaceAll('-', ' ')}</span>
                  <Badge variant="secondary">{orders.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {orders.length === 0 && (
                  <p className="py-4 text-center text-xs text-muted-foreground">Empty</p>
                )}
                {orders.map((order) => (
                  <div key={order._id} className="rounded-md border p-2.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{order.orderNumber}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatMoney(order.price)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(NEXT[status] ?? []).map((next) => (
                        <Button
                          key={next}
                          size="sm"
                          variant={next === 'cancelled' ? 'outline' : 'secondary'}
                          disabled={move.isPending}
                          onClick={() => move.mutate({ id: order._id, status: next })}
                        >
                          {next.replaceAll('-', ' ')}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
