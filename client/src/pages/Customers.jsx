import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Pencil, Trash2, Eye, Users, Phone, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import { customersApi } from '../api/resources'
import { getErrorMessage } from '../api/client'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import Pagination from '../components/ui/Pagination'
import CustomerDetail from '../components/customers/CustomerDetail'

const emptyForm = { name: '', email: '', phone: '', address: '', notes: '' }

const Customers = () => {
  const [data, setData] = useState({ data: [], total: 0, page: 1, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [viewingId, setViewingId] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    customersApi
      .list({ search, page, limit: 10 })
      .then(setData)
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [search, page])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (c) => {
    setEditing(c)
    setForm({ name: c.name, email: c.email || '', phone: c.phone, address: c.address || '', notes: c.notes || '' })
    setModalOpen(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        await customersApi.update(editing._id, form)
        toast.success('Customer updated')
      } else {
        await customersApi.create(form)
        toast.success('Customer added')
      }
      setModalOpen(false)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await customersApi.remove(deleteTarget._id)
      toast.success('Customer removed')
      setDeleteTarget(null)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search name, phone, email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <button className="btn-primary shrink-0" onClick={openCreate}>
          <Plus size={16} /> Add customer
        </button>
      </div>

      {loading ? (
        <Spinner full />
      ) : data.data.length === 0 ? (
        <div className="card">
          <EmptyState icon={Users} title="No customers found" message="Try adjusting your search or add a new customer." />
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Visits</th>
                <th>Total spent</th>
                <th>Loyalty pts</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((c) => (
                <tr key={c._id}>
                  <td className="font-medium text-slate-900">{c.name}</td>
                  <td>
                    <div className="flex flex-col gap-0.5 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Phone size={12} /> {c.phone}</span>
                      {c.email && <span className="flex items-center gap-1"><Mail size={12} /> {c.email}</span>}
                    </div>
                  </td>
                  <td>{c.visitCount}</td>
                  <td>${Number(c.totalSpent || 0).toFixed(2)}</td>
                  <td>{c.loyaltyPoints}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setViewingId(c._id)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="View">
                        <Eye size={15} />
                      </button>
                      <button onClick={() => openEdit(c)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Edit">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => setDeleteTarget(c)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" title="Delete">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit customer' : 'Add customer'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" form="customer-form" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save customer'}
            </button>
          </>
        }
      >
        <form id="customer-form" onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Full name</label>
            <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Phone</label>
              <input required className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea rows={3} className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete customer"
        message={`This will permanently delete ${deleteTarget?.name} and their vehicles. This cannot be undone.`}
      />

      <CustomerDetail customerId={viewingId} onClose={() => setViewingId(null)} />
    </div>
  )
}

export default Customers
