import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Receipt } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { expensesApi } from '../api/resources'
import { getErrorMessage } from '../api/client'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'

const categories = ['supplies', 'utilities', 'salaries', 'maintenance', 'rent', 'marketing', 'other']
const categoryColor = { supplies: 'blue', utilities: 'amber', salaries: 'purple', maintenance: 'cyan', rent: 'red', marketing: 'green', other: 'slate' }
const emptyForm = { category: 'supplies', description: '', amount: '', date: new Date().toISOString().slice(0, 10) }

const Expenses = () => {
  const [data, setData] = useState({ data: [], total: 0, page: 1, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    expensesApi
      .list({ category: category || undefined, page, limit: 10 })
      .then(setData)
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [category, page])

  useEffect(load, [load])

  const totalShown = data.data.reduce((sum, e) => sum + e.amount, 0)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await expensesApi.create({ ...form, amount: Number(form.amount) })
      toast.success('Expense recorded')
      setModalOpen(false)
      setForm(emptyForm)
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
      await expensesApi.remove(deleteTarget._id)
      toast.success('Expense removed')
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
        <select className="input w-auto" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
        </select>
        <button className="btn-primary shrink-0" onClick={() => setModalOpen(true)}>
          <Plus size={16} /> Add expense
        </button>
      </div>

      {loading ? (
        <Spinner full />
      ) : data.data.length === 0 ? (
        <div className="card">
          <EmptyState icon={Receipt} title="No expenses recorded" />
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Amount</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((e) => (
                <tr key={e._id}>
                  <td>{format(new Date(e.date), 'MMM d, yyyy')}</td>
                  <td><Badge color={categoryColor[e.category]} className="capitalize">{e.category}</Badge></td>
                  <td>{e.description}</td>
                  <td className="font-medium text-slate-900">${e.amount.toFixed(2)}</td>
                  <td>
                    <div className="flex justify-end">
                      <button onClick={() => setDeleteTarget(e)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" title="Delete">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <td colSpan={3} className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-slate-500">Page total</td>
                <td colSpan={2} className="px-4 py-2.5 font-semibold text-slate-800">${totalShown.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
          <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record expense"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" form="expense-form" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save expense'}
            </button>
          </>
        }
      >
        <form id="expense-form" onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <select className="input capitalize" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Amount ($)</label>
              <input required type="number" min="0" step="0.01" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <input required className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="label">Date</label>
            <input required type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete expense"
        message={`Delete this expense of $${deleteTarget?.amount?.toFixed(2)}?`}
      />
    </div>
  )
}

export default Expenses
