import { useCallback, useEffect, useState } from 'react'
import { Plus, ListOrdered, DoorOpen, ArrowRight, CheckCircle2, XCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import { washOrdersApi, serviceBaysApi } from '../api/resources'
import { getErrorMessage } from '../api/client'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'
import WashOrderFormModal from '../components/washqueue/WashOrderFormModal'

// Bay Attendant / Wash Technician home view (carwash-compile/01-foundation/dashboards.md):
// deliberately minimal — "the live queue (next 5 vehicles), which bay is open next, one-tap
// log new vehicle" plus one-tap qc-passed/qc-failed. Mobile-first, standing on the floor.

const STATUS_LABEL = {
  'bay-assigned': 'Bay assigned',
  'in-wash': 'In wash',
  'quality-check': 'Quality check',
}

const FloorQueue = () => {
  const [orders, setOrders] = useState([])
  const [bays, setBays] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([washOrdersApi.list({ active: 'true', limit: 50 }), serviceBaysApi.list()])
      .then(([orderRes, bayRows]) => {
        setOrders(orderRes.data)
        setBays(bayRows)
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

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

  if (loading) return <Spinner full />

  const upNext = orders.filter((o) => o.status === 'queued').slice(0, 5)
  const onFloor = orders.filter((o) => ['bay-assigned', 'in-wash', 'quality-check'].includes(o.status))
  const nextOpenBay = bays.find((b) => b.operationalStatus === 'operational' && !b.currentWashOrder)

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4 text-center">
          <ListOrdered size={18} className="mx-auto mb-1 text-brand-500" />
          <p className="text-2xl font-semibold text-slate-900">{orders.filter((o) => o.status === 'queued').length}</p>
          <p className="text-xs text-slate-500">In queue</p>
        </div>
        <div className="card p-4 text-center">
          <DoorOpen size={18} className="mx-auto mb-1 text-brand-500" />
          <p className="text-lg font-semibold text-slate-900">{nextOpenBay ? `Bay ${nextOpenBay.bayNumber}` : 'Full'}</p>
          <p className="text-xs text-slate-500">Next open bay</p>
        </div>
      </div>

      <button onClick={() => setFormOpen(true)} className="btn-primary w-full py-3 text-base">
        <Plus size={18} /> Log vehicle
      </button>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Up next</h3>
        {upNext.length === 0 ? (
          <div className="card"><EmptyState title="Queue is empty" /></div>
        ) : (
          <div className="space-y-2">
            {upNext.map((o) => (
              <div key={o._id} className="card flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">{o.vehicle.make} {o.vehicle.model}</p>
                  <p className="truncate text-xs text-slate-500">{o.vehicle.plateNumber} · {o.package.name}</p>
                </div>
                <button
                  disabled={busyId === o._id}
                  onClick={() => runAction(o._id, () => washOrdersApi.assignBay(o._id), 'Bay assigned')}
                  className="btn-secondary shrink-0 py-1.5 text-xs"
                >
                  <ArrowRight size={13} /> Assign bay
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">On the floor</h3>
        {onFloor.length === 0 ? (
          <div className="card"><EmptyState title="Nothing in a bay right now" /></div>
        ) : (
          <div className="space-y-2">
            {onFloor.map((o) => (
              <div key={o._id} className="card p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{o.vehicle.make} {o.vehicle.model} <span className="text-xs font-normal text-slate-400">Bay {o.bay?.bayNumber}</span></p>
                    <p className="truncate text-xs text-slate-500">{o.package.name}</p>
                  </div>
                  <Badge status={o.status}>{STATUS_LABEL[o.status]}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {o.status === 'bay-assigned' && (
                    <button disabled={busyId === o._id} onClick={() => runAction(o._id, () => washOrdersApi.startWash(o._id), 'Wash started')} className="btn-secondary flex-1 py-1.5 text-xs">
                      <ArrowRight size={13} /> Start wash
                    </button>
                  )}
                  {o.status === 'in-wash' && (
                    <button disabled={busyId === o._id} onClick={() => runAction(o._id, () => washOrdersApi.completeWash(o._id), 'Sent to QC')} className="btn-secondary flex-1 py-1.5 text-xs">
                      <ArrowRight size={13} /> Complete wash
                    </button>
                  )}
                  {o.status === 'quality-check' && (
                    <>
                      <button disabled={busyId === o._id} onClick={() => runAction(o._id, () => washOrdersApi.qualityCheck(o._id, 'pass'), 'QC passed')} className="btn-secondary flex-1 py-1.5 text-xs text-emerald-700">
                        <CheckCircle2 size={13} /> QC pass
                      </button>
                      <button disabled={busyId === o._id} onClick={() => runAction(o._id, () => washOrdersApi.qualityCheck(o._id, 'fail'), 'Sent back for rework')} className="btn-secondary flex-1 py-1.5 text-xs text-amber-700">
                        <XCircle size={13} /> QC fail
                      </button>
                    </>
                  )}
                </div>
                {o.washStartedAt && o.status === 'in-wash' && (
                  <p className="mt-1.5 text-[11px] text-slate-400">Washing for {formatDistanceToNow(new Date(o.washStartedAt))}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <WashOrderFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); load() }} />
    </div>
  )
}

export default FloorQueue
