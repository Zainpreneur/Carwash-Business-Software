import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { Plus, Users, CalendarClock, Palmtree, AlertTriangle, LogIn, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'
import { hrApi } from '../api/resources'
import { getErrorMessage } from '../api/client'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'

// HR (03-operations/hr.md) — Employee (the HR record) is explicitly distinct from the
// login/RBAC role managed on the existing /staff page; this page is the roster,
// scheduling, and leave side of that same person.
const POSITIONS = ['bay-attendant', 'wash-technician', 'detail-technician', 'cashier', 'site-manager', 'fleet-account-manager']
const STATUSES = ['applicant', 'hired', 'onboarding', 'active', 'on-leave', 'offboarded']
const currency = (n) => `$${Number(n || 0).toFixed(2)}`
const emptyEmployeeForm = { name: '', phone: '', email: '', position: 'bay-attendant', status: 'active', hourlyRate: '', annualSalary: '', commissionRate: '' }
const emptyShiftForm = { employee: '', startsAt: '', endsAt: '' }
const emptyLeaveForm = { employee: '', startDate: '', endDate: '', reason: '' }

const TABS = [
  { key: 'employees', label: 'Employees', icon: Users },
  { key: 'shifts', label: 'Shifts', icon: CalendarClock },
  { key: 'leave', label: 'Leave', icon: Palmtree },
]

const HR = () => {
  const [tab, setTab] = useState('employees')
  const [employees, setEmployees] = useState([])
  const [shifts, setShifts] = useState([])
  const [leaveRequests, setLeaveRequests] = useState([])
  const [loading, setLoading] = useState(true)

  const [empModalOpen, setEmpModalOpen] = useState(false)
  const [empForm, setEmpForm] = useState(emptyEmployeeForm)
  const [shiftModalOpen, setShiftModalOpen] = useState(false)
  const [shiftForm, setShiftForm] = useState(emptyShiftForm)
  const [leaveModalOpen, setLeaveModalOpen] = useState(false)
  const [leaveForm, setLeaveForm] = useState(emptyLeaveForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([hrApi.employees.list(), hrApi.shifts.list(), hrApi.leaveRequests.list()])
      .then(([e, s, l]) => {
        setEmployees(e)
        setShifts(s)
        setLeaveRequests(l)
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const submitEmployee = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await hrApi.employees.create({
        ...empForm,
        hourlyRate: empForm.hourlyRate ? Number(empForm.hourlyRate) : undefined,
        annualSalary: empForm.annualSalary ? Number(empForm.annualSalary) : undefined,
        commissionRate: empForm.commissionRate ? Number(empForm.commissionRate) : undefined,
      })
      toast.success('Employee added')
      setEmpModalOpen(false)
      setEmpForm(emptyEmployeeForm)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const submitShift = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await hrApi.shifts.create(shiftForm)
      toast.success('Shift scheduled')
      setShiftModalOpen(false)
      setShiftForm(emptyShiftForm)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const clockAction = async (id, action) => {
    try {
      await (action === 'in' ? hrApi.shifts.clockIn(id) : hrApi.shifts.clockOut(id))
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const submitLeave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await hrApi.leaveRequests.create(leaveForm)
      toast.success('Leave request submitted')
      setLeaveModalOpen(false)
      setLeaveForm(emptyLeaveForm)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const decideLeave = async (id, status) => {
    try {
      await hrApi.leaveRequests.decide(id, status)
      toast.success(`Leave request ${status}`)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
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
          </button>
        ))}
      </div>

      {tab === 'employees' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button className="btn-primary" onClick={() => setEmpModalOpen(true)}><Plus size={16} /> Add employee</button>
          </div>
          {employees.length === 0 ? (
            <div className="card"><EmptyState icon={Users} title="No employees yet" /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Name</th><th>Position</th><th>Status</th><th>Pay</th><th>Hire date</th></tr></thead>
                  <tbody>
                    {employees.map((e) => (
                      <tr key={e._id}>
                        <td className="font-medium text-slate-800">{e.name}</td>
                        <td className="capitalize">{e.position.replace(/-/g, ' ')}</td>
                        <td><Badge status={e.status}>{e.status}</Badge></td>
                        <td>
                          {e.hourlyRate ? `${currency(e.hourlyRate)}/hr` : e.annualSalary ? `${currency(e.annualSalary)}/yr` : '—'}
                          {e.commissionRate ? ` + ${(e.commissionRate * 100).toFixed(0)}% commission` : ''}
                        </td>
                        <td className="text-xs text-slate-500">{e.hireDate ? format(new Date(e.hireDate), 'MMM d, yyyy') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'shifts' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button className="btn-primary" onClick={() => setShiftModalOpen(true)}><Plus size={16} /> Schedule shift</button>
          </div>
          {shifts.length === 0 ? (
            <div className="card"><EmptyState icon={CalendarClock} title="No shifts scheduled" /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Employee</th><th>Window</th><th>Status</th><th>Clock</th><th></th></tr></thead>
                  <tbody>
                    {shifts.map((s) => (
                      <tr key={s._id}>
                        <td className="font-medium text-slate-800">{s.employee.name}</td>
                        <td className="whitespace-nowrap text-xs text-slate-500">
                          {format(new Date(s.startsAt), 'MMM d, h:mm a')} – {format(new Date(s.endsAt), 'h:mm a')}
                        </td>
                        <td>
                          <Badge status={s.status}>{s.status}</Badge>
                          {s.isLate && <span className="ml-1.5 inline-flex items-center gap-1 text-xs font-medium text-rose-600"><AlertTriangle size={12} /> Late</span>}
                        </td>
                        <td className="text-xs text-slate-500">
                          {s.checkedInAt && `In ${format(new Date(s.checkedInAt), 'h:mm a')}`}
                          {s.checkedOutAt && ` · Out ${format(new Date(s.checkedOutAt), 'h:mm a')}`}
                        </td>
                        <td>
                          {s.status === 'scheduled' && !s.checkedInAt && (
                            <button className="btn-secondary py-1 text-xs" onClick={() => clockAction(s._id, 'in')}><LogIn size={13} /> Clock in</button>
                          )}
                          {s.status === 'scheduled' && s.checkedInAt && (
                            <button className="btn-secondary py-1 text-xs" onClick={() => clockAction(s._id, 'out')}><LogOut size={13} /> Clock out</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'leave' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button className="btn-primary" onClick={() => setLeaveModalOpen(true)}><Plus size={16} /> Request leave</button>
          </div>
          {leaveRequests.length === 0 ? (
            <div className="card"><EmptyState icon={Palmtree} title="No leave requests" /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Employee</th><th>Window</th><th>Reason</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {leaveRequests.map((l) => (
                      <tr key={l._id}>
                        <td className="font-medium text-slate-800">{l.employee.name}</td>
                        <td className="whitespace-nowrap text-xs text-slate-500">
                          {format(new Date(l.startDate), 'MMM d')} – {format(new Date(l.endDate), 'MMM d, yyyy')}
                        </td>
                        <td className="text-xs text-slate-500">{l.reason || '—'}</td>
                        <td><Badge status={l.status}>{l.status}</Badge></td>
                        <td>
                          {l.status === 'pending' && (
                            <div className="flex gap-1.5">
                              <button className="btn-secondary py-1 text-xs" onClick={() => decideLeave(l._id, 'approved')}>Approve</button>
                              <button className="btn-secondary py-1 text-xs" onClick={() => decideLeave(l._id, 'denied')}>Deny</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add employee */}
      <Modal open={empModalOpen} onClose={() => setEmpModalOpen(false)} title="Add employee">
        <form id="emp-form" onSubmit={submitEmployee} className="space-y-3">
          <div><label className="label">Name</label><input className="input" value={empForm.name} onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Phone</label><input className="input" value={empForm.phone} onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })} /></div>
            <div><label className="label">Email</label><input className="input" value={empForm.email} onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Position</label>
              <select className="input" value={empForm.position} onChange={(e) => setEmpForm({ ...empForm, position: e.target.value })}>
                {POSITIONS.map((p) => <option key={p} value={p}>{p.replace(/-/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={empForm.status} onChange={(e) => setEmpForm({ ...empForm, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Hourly rate</label><input type="number" step="0.01" className="input" value={empForm.hourlyRate} onChange={(e) => setEmpForm({ ...empForm, hourlyRate: e.target.value })} placeholder="or annual salary" /></div>
            <div><label className="label">Annual salary</label><input type="number" step="0.01" className="input" value={empForm.annualSalary} onChange={(e) => setEmpForm({ ...empForm, annualSalary: e.target.value })} placeholder="or hourly rate" /></div>
          </div>
          {empForm.position === 'detail-technician' && (
            <div><label className="label">Commission rate (0–1)</label><input type="number" step="0.01" className="input" value={empForm.commissionRate} onChange={(e) => setEmpForm({ ...empForm, commissionRate: e.target.value })} placeholder="0.10" /></div>
          )}
        </form>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => setEmpModalOpen(false)}>Cancel</button>
          <button type="submit" form="emp-form" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add employee'}</button>
        </div>
      </Modal>

      {/* Schedule shift */}
      <Modal open={shiftModalOpen} onClose={() => setShiftModalOpen(false)} title="Schedule shift">
        <form id="shift-form" onSubmit={submitShift} className="space-y-3">
          <div>
            <label className="label">Employee</label>
            <select className="input" value={shiftForm.employee} onChange={(e) => setShiftForm({ ...shiftForm, employee: e.target.value })} required>
              <option value="">Select…</option>
              {employees.filter((e) => e.status === 'active' || e.status === 'on-leave').map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Starts</label><input type="datetime-local" className="input" value={shiftForm.startsAt} onChange={(e) => setShiftForm({ ...shiftForm, startsAt: e.target.value })} required /></div>
            <div><label className="label">Ends</label><input type="datetime-local" className="input" value={shiftForm.endsAt} onChange={(e) => setShiftForm({ ...shiftForm, endsAt: e.target.value })} required /></div>
          </div>
        </form>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => setShiftModalOpen(false)}>Cancel</button>
          <button type="submit" form="shift-form" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Schedule'}</button>
        </div>
      </Modal>

      {/* Request leave */}
      <Modal open={leaveModalOpen} onClose={() => setLeaveModalOpen(false)} title="Request leave">
        <form id="leave-form" onSubmit={submitLeave} className="space-y-3">
          <div>
            <label className="label">Employee</label>
            <select className="input" value={leaveForm.employee} onChange={(e) => setLeaveForm({ ...leaveForm, employee: e.target.value })} required>
              <option value="">Select…</option>
              {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">From</label><input type="date" className="input" value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} required /></div>
            <div><label className="label">To</label><input type="date" className="input" value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} required /></div>
          </div>
          <div><label className="label">Reason</label><input className="input" value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} /></div>
        </form>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => setLeaveModalOpen(false)}>Cancel</button>
          <button type="submit" form="leave-form" className="btn-primary" disabled={saving}>{saving ? 'Submitting…' : 'Submit request'}</button>
        </div>
      </Modal>
    </div>
  )
}

export default HR
