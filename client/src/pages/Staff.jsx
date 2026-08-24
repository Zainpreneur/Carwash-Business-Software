import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, UserCog, Mail, Phone } from 'lucide-react'
import toast from 'react-hot-toast'
import { usersApi } from '../api/resources'
import { getErrorMessage } from '../api/client'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'
import { useAuth } from '../context/AuthContext'

const roles = ['admin', 'manager', 'staff']
const emptyForm = { name: '', email: '', password: '', phone: '', role: 'staff', active: true }

const Staff = () => {
  const { user: me } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    usersApi
      .list()
      .then(setUsers)
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (u) => {
    setEditing(u)
    setForm({ name: u.name, email: u.email, password: '', phone: u.phone || '', role: u.role, active: u.active })
    setModalOpen(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        const payload = { ...form }
        if (!payload.password) delete payload.password
        await usersApi.update(editing._id, payload)
        toast.success('Staff member updated')
      } else {
        await usersApi.create(form)
        toast.success('Staff member added')
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
      await usersApi.remove(deleteTarget._id)
      toast.success('Staff member removed')
      setDeleteTarget(null)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  const canManage = me?.role === 'admin'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{users.length} team members</p>
        {canManage && (
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={16} /> Add staff
          </button>
        )}
      </div>

      {loading ? (
        <Spinner full />
      ) : users.length === 0 ? (
        <div className="card">
          <EmptyState icon={UserCog} title="No staff members" />
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Role</th>
                <th>Status</th>
                {canManage && <th className="text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td className="flex items-center gap-2 font-medium text-slate-900">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                      style={{ backgroundColor: u.avatarColor || '#0284c7' }}
                    >
                      {u.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                    </span>
                    {u.name}
                  </td>
                  <td>
                    <div className="flex flex-col gap-0.5 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Mail size={12} /> {u.email}</span>
                      {u.phone && <span className="flex items-center gap-1"><Phone size={12} /> {u.phone}</span>}
                    </div>
                  </td>
                  <td><Badge status={u.role}>{u.role}</Badge></td>
                  <td><Badge status={u.active ? 'active' : 'inactive'}>{u.active ? 'Active' : 'Inactive'}</Badge></td>
                  {canManage && (
                    <td>
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(u)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Edit">
                          <Pencil size={15} />
                        </button>
                        {u._id !== me._id && (
                          <button onClick={() => setDeleteTarget(u)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" title="Delete">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit staff member' : 'Add staff member'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" form="staff-form" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <form id="staff-form" onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Full name</label>
            <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Email</label>
              <input type="email" required className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Role</label>
              <select className="input capitalize" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {roles.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{editing ? 'New password (optional)' : 'Password'}</label>
              <input type="password" required={!editing} minLength={6} className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Active account
            </label>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Remove staff member"
        message={`Remove ${deleteTarget?.name} from the team?`}
      />
    </div>
  )
}

export default Staff
