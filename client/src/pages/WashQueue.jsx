import { useCallback, useEffect, useState } from 'react'
import { Plus, Waves, ArrowRight, CheckCircle2, XCircle, LogOut, Ban, Receipt } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { washOrdersApi, serviceBaysApi, documentsApi } from '../api/resources'
import { getErrorMessage } from '../api/client'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'
import BayBoard from '../components/washqueue/BayBoard'
import WashOrderFormModal from '../components/washqueue/WashOrderFormModal'
import DocumentViewer from '../components/documents/DocumentViewer'

const STATUS_LABEL = {
  queued: 'Queued',
  'bay-assigned': 'Bay assigned',
  'in-wash': 'In wash',
  'quality-check': 'Quality check',
  'ready-for-pickup': 'Ready for pickup',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const WashQueue = () => {
  const [bays, setBays] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [doc, setDoc] = useState(null)
  const [docOpen, setDocOpen] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      serviceBaysApi.list(),
      washOrdersApi.list(showAll ? { limit: 50 } : { active: 'true', limit: 50 }),
    ])
      .then(([bayRows, orderRows]) => {
        setBays(bayRows)
        setOrders(orderRows.data)
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [showAll])

  useEffect(load, [load])

  const runAction = async (id, fn, successMsg) => {
    setBusyId(id)
    try {
      await fn()
      if (successMsg) toast.success(successMsg)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const onSaved = () => {
    setFormOpen(false)
    load()
  }

  const viewReceipt = async (orderId) => {
    try {
      setDoc(await documentsApi.washReceipt(orderId))
      setDocOpen(true)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Bay board</h3>
        {bays.length === 0 && !loading ? (
          <div className="card">
            <EmptyState icon={Waves} title="No bays configured" />
          </div>
        ) : (
          <BayBoard bays={bays} />
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Show completed &amp; cancelled
        </label>
        <button className="btn-primary shrink-0" onClick={() => setFormOpen(true)}>
          <Plus size={16} /> Log vehicle
        </button>
      </div>

      {loading ? (
        <Spinner full />
      ) : orders.length === 0 ? (
        <div className="card">
          <EmptyState icon={Waves} title="Queue is empty" message="Log a vehicle to start the wash lifecycle." />
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Vehicle</th>
                <th>Package</th>
                <th>Bay</th>
                <th>Price</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const isBusy = busyId === o._id
                return (
                  <tr key={o._id}>
                    <td className="font-medium text-slate-900">{o.orderNumber}</td>
                    <td>
                      {o.vehicle.make} {o.vehicle.model}
                      <span className="block text-xs text-slate-400">{o.vehicle.plateNumber} · {o.customer?.name || 'Walk-in'}</span>
                    </td>
                    <td>{o.package.name}</td>
                    <td>{o.bay ? `Bay ${o.bay.bayNumber}` : '—'}</td>
                    <td>${Number(o.price).toFixed(2)}</td>
                    <td><Badge status={o.status}>{STATUS_LABEL[o.status] || o.status}</Badge></td>
                    <td>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {o.status === 'queued' && (
                          <>
                            <button
                              disabled={isBusy}
                              onClick={() => runAction(o._id, () => washOrdersApi.assignBay(o._id), 'Bay assigned')}
                              className="btn-secondary py-1 text-xs"
                            >
                              <ArrowRight size={13} /> Assign bay
                            </button>
                            <button
                              disabled={isBusy}
                              onClick={() => runAction(o._id, () => washOrdersApi.cancel(o._id), 'Cancelled')}
                              className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                              title="Cancel"
                            >
                              <Ban size={14} />
                            </button>
                          </>
                        )}
                        {o.status === 'bay-assigned' && (
                          <>
                            <button
                              disabled={isBusy}
                              onClick={() => runAction(o._id, () => washOrdersApi.startWash(o._id), 'Wash started')}
                              className="btn-secondary py-1 text-xs"
                            >
                              <ArrowRight size={13} /> Start wash
                            </button>
                            <button
                              disabled={isBusy}
                              onClick={() => runAction(o._id, () => washOrdersApi.cancel(o._id), 'Cancelled (no-show)')}
                              className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                              title="No-show / cancel"
                            >
                              <Ban size={14} />
                            </button>
                          </>
                        )}
                        {o.status === 'in-wash' && (
                          <button
                            disabled={isBusy}
                            onClick={() => runAction(o._id, () => washOrdersApi.completeWash(o._id), 'Wash complete — sent to QC')}
                            className="btn-secondary py-1 text-xs"
                          >
                            <ArrowRight size={13} /> Complete wash
                          </button>
                        )}
                        {o.status === 'quality-check' && (
                          <>
                            <button
                              disabled={isBusy}
                              onClick={() => runAction(o._id, () => washOrdersApi.qualityCheck(o._id, 'pass'), 'QC passed')}
                              className="btn-secondary py-1 text-xs text-emerald-700"
                            >
                              <CheckCircle2 size={13} /> QC pass
                            </button>
                            <button
                              disabled={isBusy}
                              onClick={() => runAction(o._id, () => washOrdersApi.qualityCheck(o._id, 'fail'), 'Sent back for rework')}
                              className="btn-secondary py-1 text-xs text-amber-700"
                            >
                              <XCircle size={13} /> QC fail
                            </button>
                          </>
                        )}
                        {o.status === 'ready-for-pickup' && (
                          <button
                            disabled={isBusy}
                            onClick={() => runAction(o._id, () => washOrdersApi.checkout(o._id), 'Checked out')}
                            className="btn-primary py-1 text-xs"
                          >
                            <LogOut size={13} /> Checkout
                          </button>
                        )}
                        {o.status === 'completed' && (
                          <>
                            <button onClick={() => viewReceipt(o._id)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" title="View receipt">
                              <Receipt size={14} />
                            </button>
                            <span className="text-xs text-slate-400">{format(new Date(o.checkedOutAt || o.updatedAt), 'MMM d, h:mm a')}</span>
                          </>
                        )}
                        {o.status === 'cancelled' && <span className="text-xs text-slate-400">—</span>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <WashOrderFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={onSaved} />
      <DocumentViewer open={docOpen} onClose={() => setDocOpen(false)} doc={doc} />
    </div>
  )
}

export default WashQueue
