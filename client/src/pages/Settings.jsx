import { useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { usersApi } from '../api/resources'
import { getErrorMessage } from '../api/client'

const colorOptions = ['#0284c7', '#7c3aed', '#0891b2', '#ea580c', '#16a34a', '#e11d48', '#db2777', '#65a30d']

const Settings = () => {
  const { user, logout } = useAuth()
  const [form, setForm] = useState({ name: user?.name || '', phone: '', avatarColor: user?.avatarColor || colorOptions[0] })
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const initials = (user?.name || '?').split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { name: form.name, phone: form.phone, avatarColor: form.avatarColor }
      if (password) payload.password = password
      const updated = await usersApi.update(user._id, payload)
      localStorage.setItem('cw_user', JSON.stringify({ ...user, ...updated }))
      toast.success('Profile updated. Refresh to see all changes.')
      setPassword('')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="card p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <span
            className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold text-white"
            style={{ backgroundColor: form.avatarColor }}
          >
            {initials}
          </span>
          <div>
            <p className="text-lg font-semibold text-slate-900">{user?.name}</p>
            <p className="text-sm capitalize text-slate-500">{user?.role} · {user?.email}</p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="label">Full name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Avatar color</label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setForm({ ...form, avatarColor: c })}
                  className="h-8 w-8 rounded-full ring-offset-2 transition-shadow"
                  style={{ backgroundColor: c, boxShadow: form.avatarColor === c ? `0 0 0 2px ${c}` : 'none' }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="label">New password (leave blank to keep current)</label>
            <input type="password" minLength={6} className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>

      <div className="card p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-slate-800">Session</h3>
        <p className="mt-1 text-sm text-slate-500">Sign out of your SudsFlow account on this device.</p>
        <button onClick={logout} className="btn-danger mt-4">Sign out</button>
      </div>
    </div>
  )
}

export default Settings
