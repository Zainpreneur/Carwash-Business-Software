import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { Plus, Boxes, ClipboardList, AlertTriangle, Sparkles, PackageCheck, PackageX } from 'lucide-react'
import toast from 'react-hot-toast'
import { inventoryApi, hrApi } from '../api/resources'
import { getErrorMessage } from '../api/client'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'

// Inventory & purchasing (03-operations/inventory.md). inventory-forecaster's
// recommendations are read-only here until "Run forecast now" actually creates the POs —
// this app has no nightly scheduler, so a site-manager triggers it on demand instead.
const REASON_CODES = ['breakage', 'spillage', 'theft', 'expired', 'count-correction']
const currency = (n) => `$${Number(n || 0).toFixed(2)}`
const emptySupplyForm = { name: '', warehouse: 'main-chemical-room', unit: 'unit', quantityOnHand: '', unitCost: '', supplier: '' }
const emptyAdjustmentForm = { supply: '', quantityDelta: '', reasonCode: 'breakage', notes: '', approvedBy: '' }

const TABS = [
  { key: 'supplies', label: 'Supplies', icon: Boxes },
  { key: 'orders', label: 'Purchase Orders', icon: ClipboardList },
  { key: 'adjustments', label: 'Adjustments', icon: AlertTriangle },
  { key: 'forecast', label: 'Forecast', icon: Sparkles },
]

const Inventory = () => {
  const [tab, setTab] = useState('supplies')
  const [supplies, setSupplies] = useState([])
  const [orders, setOrders] = useState([])
  const [adjustments, setAdjustments] = useState([])
  const [forecast, setForecast] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)

  const [supplyModalOpen, setSupplyModalOpen] = useState(false)
  const [supplyForm, setSupplyForm] = useState(emptySupplyForm)
  const [adjModalOpen, setAdjModalOpen] = useState(false)
  const [adjForm, setAdjForm] = useState(emptyAdjustmentForm)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [activeOrder, setActiveOrder] = useState(null)
  const [receiveQty, setReceiveQty] = useState({})

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([inventoryApi.supplies.list(), inventoryApi.purchaseOrders.list(), inventoryApi.adjustments.list(), inventoryApi.forecast.preview(), hrApi.employees.list()])
      .then(([s, o, a, f, e]) => {
        setSupplies(s)
        setOrders(o)
        setAdjustments(a)
        setForecast(f)
        setEmployees(e)
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const submitSupply = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await inventoryApi.supplies.create({
        ...supplyForm,
        quantityOnHand: Number(supplyForm.quantityOnHand) || 0,
        unitCost: Number(supplyForm.unitCost) || 0,
        supplier: supplyForm.supplier || undefined,
      })
      toast.success('Supply added')
      setSupplyModalOpen(false)
      setSupplyForm(emptySupplyForm)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const submitAdjustment = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await inventoryApi.adjustments.create({ ...adjForm, quantityDelta: Number(adjForm.quantityDelta) })
      toast.success('Adjustment recorded')
      setAdjModalOpen(false)
      setAdjForm(emptyAdjustmentForm)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const runForecast = async () => {
    setBusy(true)
    try {
      const created = await inventoryApi.forecast.run()
      toast.success(created.length ? `${created.length} purchase order(s) created` : 'Nothing to reorder right now')
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const openOrder = async (id) => {
    try {
      const order = await inventoryApi.purchaseOrders.get(id)
      setActiveOrder(order)
      setReceiveQty(Object.fromEntries(order.lines.map((l) => [l._id, l.quantityOrdered - l.quantityReceived])))
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const approveOrder = async (id) => {
    setBusy(true)
    try {
      await inventoryApi.purchaseOrders.approve(id)
      toast.success('Approved and sent')
      openOrder(id)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const receiveOrder = async () => {
    setBusy(true)
    try {
      const receivedLines = Object.entries(receiveQty).filter(([, qty]) => Number(qty) > 0).map(([lineId, qty]) => ({ lineId, quantityReceived: Number(qty) }))
      await inventoryApi.purchaseOrders.receive(activeOrder._id, receivedLines)
      toast.success('Shipment received')
      openOrder(activeOrder._id)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const closeOrder = async () => {
    setBusy(true)
    try {
      await inventoryApi.purchaseOrders.close(activeOrder._id)
      toast.success('Purchase order closed')
      setActiveOrder(null)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner full />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-medium ${tab === t.key ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <t.icon size={15} /> {t.label}
            {t.key === 'forecast' && forecast.length > 0 && <span className="ml-1 rounded-full bg-rose-500 px-1.5 text-xs text-white">{forecast.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'supplies' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button className="btn-primary" onClick={() => setSupplyModalOpen(true)}><Plus size={16} /> Add supply</button>
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Name</th><th>Warehouse</th><th>On hand</th><th>Unit cost</th><th>Supplier</th></tr></thead>
                <tbody>
                  {supplies.map((s) => (
                    <tr key={s._id}>
                      <td className="font-medium text-slate-800">{s.name}</td>
                      <td className="capitalize text-xs text-slate-500">{s.warehouse.replace(/-/g, ' ')}</td>
                      <td>{s.quantityOnHand} {s.unit}</td>
                      <td>{currency(s.unitCost)}</td>
                      <td className="text-xs text-slate-500">{s.supplier?.name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <div className="card"><EmptyState icon={ClipboardList} title="No purchase orders yet" /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Supplier</th><th>Status</th><th>Total</th><th>Source</th><th>Created</th></tr></thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o._id} className="cursor-pointer hover:bg-slate-50" onClick={() => openOrder(o._id)}>
                        <td className="font-medium text-slate-800">{o.supplier.name}</td>
                        <td><Badge status={o.status}>{o.status}</Badge></td>
                        <td>{currency(o.totalAmount)}</td>
                        <td className="text-xs capitalize text-slate-500">{o.source.replace(/-/g, ' ')}</td>
                        <td className="text-xs text-slate-500">{format(new Date(o.createdAt), 'MMM d, yyyy')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'adjustments' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button className="btn-primary" onClick={() => setAdjModalOpen(true)}><Plus size={16} /> Record adjustment</button>
          </div>
          {adjustments.length === 0 ? (
            <div className="card"><EmptyState icon={AlertTriangle} title="No adjustments recorded" /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Supply</th><th>Qty</th><th>Reason</th><th>Approved by</th><th>Date</th></tr></thead>
                  <tbody>
                    {adjustments.map((a) => (
                      <tr key={a._id}>
                        <td className="font-medium text-slate-800">{a.supply.name}</td>
                        <td className={a.quantityDelta < 0 ? 'text-rose-600' : 'text-emerald-600'}>{a.quantityDelta > 0 ? '+' : ''}{a.quantityDelta}</td>
                        <td className="capitalize text-xs text-slate-500">{a.reasonCode.replace('-', ' ')}</td>
                        <td className="text-xs text-slate-500">{a.approvedBy.name}</td>
                        <td className="text-xs text-slate-500">{format(new Date(a.createdAt), 'MMM d, yyyy')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'forecast' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Reorder to a 30-day par level whenever on-hand drops below a 7-day average-consumption supply, from trailing wash volume by package mix.</p>
            <button className="btn-primary shrink-0" disabled={busy || forecast.length === 0} onClick={runForecast}>
              <Sparkles size={16} /> Run forecast now
            </button>
          </div>
          {forecast.length === 0 ? (
            <div className="card"><EmptyState icon={Sparkles} title="Nothing needs reordering" message="Every supply is above its 7-day reorder point." /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Supply</th><th>On hand</th><th>7-day supply</th><th>Recommended order</th><th>Est. cost</th></tr></thead>
                  <tbody>
                    {forecast.map((f) => (
                      <tr key={f.supply._id}>
                        <td className="font-medium text-slate-800">{f.supply.name}</td>
                        <td className="text-rose-600">{f.supply.quantityOnHand} {f.supply.unit}</td>
                        <td>{f.sevenDaySupply} {f.supply.unit}</td>
                        <td>{f.recommendedQuantity} {f.supply.unit}</td>
                        <td>{currency(f.estimatedCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add supply */}
      <Modal open={supplyModalOpen} onClose={() => setSupplyModalOpen(false)} title="Add supply">
        <form id="supply-form" onSubmit={submitSupply} className="space-y-3">
          <div><label className="label">Name</label><input className="input" value={supplyForm.name} onChange={(e) => setSupplyForm({ ...supplyForm, name: e.target.value })} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Warehouse</label>
              <select className="input" value={supplyForm.warehouse} onChange={(e) => setSupplyForm({ ...supplyForm, warehouse: e.target.value })}>
                <option value="main-chemical-room">Main Chemical Room</option>
                <option value="detail-bay-storage">Detail Bay Storage</option>
              </select>
            </div>
            <div><label className="label">Unit</label><input className="input" value={supplyForm.unit} onChange={(e) => setSupplyForm({ ...supplyForm, unit: e.target.value })} placeholder="gallon, case…" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Quantity on hand</label><input type="number" step="0.01" className="input" value={supplyForm.quantityOnHand} onChange={(e) => setSupplyForm({ ...supplyForm, quantityOnHand: e.target.value })} /></div>
            <div><label className="label">Unit cost</label><input type="number" step="0.01" className="input" value={supplyForm.unitCost} onChange={(e) => setSupplyForm({ ...supplyForm, unitCost: e.target.value })} /></div>
          </div>
        </form>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => setSupplyModalOpen(false)}>Cancel</button>
          <button type="submit" form="supply-form" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add supply'}</button>
        </div>
      </Modal>

      {/* Record adjustment */}
      <Modal open={adjModalOpen} onClose={() => setAdjModalOpen(false)} title="Record stock adjustment">
        <form id="adj-form" onSubmit={submitAdjustment} className="space-y-3">
          <div>
            <label className="label">Supply</label>
            <select className="input" value={adjForm.supply} onChange={(e) => setAdjForm({ ...adjForm, supply: e.target.value })} required>
              <option value="">Select…</option>
              {supplies.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Quantity (negative = loss)</label><input type="number" step="0.01" className="input" value={adjForm.quantityDelta} onChange={(e) => setAdjForm({ ...adjForm, quantityDelta: e.target.value })} required /></div>
            <div>
              <label className="label">Reason</label>
              <select className="input" value={adjForm.reasonCode} onChange={(e) => setAdjForm({ ...adjForm, reasonCode: e.target.value })}>
                {REASON_CODES.map((r) => <option key={r} value={r}>{r.replace('-', ' ')}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Approved by</label>
            <select className="input" value={adjForm.approvedBy} onChange={(e) => setAdjForm({ ...adjForm, approvedBy: e.target.value })} required>
              <option value="">Select an employee…</option>
              {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          </div>
          <div><label className="label">Notes</label><input className="input" value={adjForm.notes} onChange={(e) => setAdjForm({ ...adjForm, notes: e.target.value })} /></div>
        </form>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => setAdjModalOpen(false)}>Cancel</button>
          <button type="submit" form="adj-form" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Record'}</button>
        </div>
      </Modal>

      {/* Purchase order detail */}
      <Modal open={!!activeOrder} onClose={() => setActiveOrder(null)} title="Purchase order" size="lg">
        {activeOrder && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge status={activeOrder.status}>{activeOrder.status}</Badge>
              <span className="text-sm text-slate-600">{activeOrder.supplier.name}</span>
              <span className="ml-auto text-sm font-medium text-slate-800">{currency(activeOrder.totalAmount)}</span>
            </div>
            <table className="table">
              <thead><tr><th>Supply</th><th>Ordered</th><th>Received</th>{['sent', 'partially-received'].includes(activeOrder.status) && <th>Receive now</th>}</tr></thead>
              <tbody>
                {activeOrder.lines.map((l) => (
                  <tr key={l._id}>
                    <td className="font-medium text-slate-800">{l.supply.name}</td>
                    <td>{l.quantityOrdered} {l.supply.unit}</td>
                    <td>{l.quantityReceived} {l.supply.unit}</td>
                    {['sent', 'partially-received'].includes(activeOrder.status) && (
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className="input w-24 py-1"
                          value={receiveQty[l._id] ?? ''}
                          onChange={(e) => setReceiveQty({ ...receiveQty, [l._id]: e.target.value })}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end gap-2">
              {activeOrder.status === 'draft' && (
                <button className="btn-primary" disabled={busy} onClick={() => approveOrder(activeOrder._id)}>Approve &amp; send</button>
              )}
              {['sent', 'partially-received'].includes(activeOrder.status) && (
                <button className="btn-primary" disabled={busy} onClick={receiveOrder}><PackageCheck size={15} /> Receive shipment</button>
              )}
              {activeOrder.status === 'received' && (
                <button className="btn-primary" disabled={busy} onClick={closeOrder}><PackageX size={15} /> Close (mark paid)</button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default Inventory
