import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Building2,
  Palette,
  CalendarClock,
  MapPin,
  Users,
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Loader2,
  Check,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { tenantApi } from '../api/resources'
import { getErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useTenant } from '../context/TenantContext'
import Modal from '../components/ui/Modal'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'

const BRAND_PRESETS = [
  '#0284c7',
  '#0ea5e9',
  '#0891b2',
  '#7c3aed',
  '#9333ea',
  '#e11d48',
  '#ea580c',
  '#16a34a',
  '#65a30d',
  '#0f766e',
]

const ROLE_OPTIONS = ['admin', 'manager', 'staff']

const FEATURE_LABELS = {
  washFloor: 'Wash floor',
  bookings: 'Bookings',
  reports: 'Reports',
  memberships: 'Memberships',
  inventory: 'Inventory',
  hr: 'HR & shifts',
  whatsapp: 'WhatsAlerts',
}

const TABS = [
  { key: 'branding', label: 'Branding', icon: Palette },
  { key: 'locations', label: 'Branches', icon: MapPin },
  { key: 'team', label: 'Team', icon: Users },
  { key: 'plan', label: 'Plan', icon: CreditCard },
]

const BusinessSettings = () => {
  const { tenant, plan, features, locations, refreshTenant } = useTenant()
  const { user } = useAuth()
  const [tab, setTab] = useState('branding')

  // --- Branding ----------------------------------------------------------
  const [brand, setBrand] = useState({
    name: '',
    brandColor: '#0284c7',
    logoUrl: '',
    phone: '',
    address: '',
    currency: 'USD',
    timezone: 'Asia/Riyadh',
    taxRate: 0,
  })
  const [savingBrand, setSavingBrand] = useState(false)

  useEffect(() => {
    if (!tenant) return
    setBrand({
      name: tenant.name || '',
      brandColor: tenant.brandColor || '#0284c7',
      logoUrl: tenant.logoUrl || '',
      phone: tenant.phone || '',
      address: tenant.address || '',
      currency: tenant.currency || 'USD',
      timezone: tenant.timezone || 'Asia/Riyadh',
      taxRate: tenant.taxRate || 0,
    })
  }, [tenant?._id, tenant?.updatedAt, tenant?.brandColor, tenant?.name])

  const saveBrand = async (e) => {
    e.preventDefault()
    setSavingBrand(true)
    try {
      await tenantApi.update({
        name: brand.name,
        brandColor: brand.brandColor,
        logoUrl: brand.logoUrl || null,
        phone: brand.phone,
        address: brand.address,
        currency: brand.currency,
        timezone: brand.timezone,
        taxRate: Number(brand.taxRate) || 0,
      })
      await refreshTenant()
      toast.success('Branding updated')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingBrand(false)
    }
  }

  // --- Branches ----------------------------------------------------------
  const [locationModal, setLocationModal] = useState(null)
  const [locationForm, setLocationForm] = useState({ name: '', code: '', address: '', city: '', phone: '' })
  const [savingLocation, setSavingLocation] = useState(false)

  const saveLocation = async (e) => {
    e.preventDefault()
    setSavingLocation(true)
    try {
      if (locationModal?.id) {
        await tenantApi.updateLocation(locationModal.id, locationForm)
        toast.success('Branch updated')
      } else {
        await tenantApi.createLocation(locationForm)
        toast.success('Branch added')
      }
      setLocationModal(null)
      await refreshTenant()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingLocation(false)
    }
  }

  const deactivateLocation = async (id) => {
    try {
      await tenantApi.deleteLocation(id)
      toast.success('Branch deactivated')
      await refreshTenant()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  // --- Team --------------------------------------------------------------
  const [members, setMembers] = useState([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [memberModal, setMemberModal] = useState(null)
  const [memberForm, setMemberForm] = useState({ name: '', email: '', password: '', role: 'staff' })
  const [savingMember, setSavingMember] = useState(false)
  const [invite, setInvite] = useState(null)

  const loadMembers = useCallback(() => {
    setLoadingMembers(true)
    tenantApi
      .members()
      .then(setMembers)
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoadingMembers(false))
  }, [])

  useEffect(loadMembers, [loadMembers])

  const saveMember = async (e) => {
    e.preventDefault()
    setSavingMember(true)
    try {
      await tenantApi.addMember(memberForm)
      toast.success('Team member added')
      setMemberModal(null)
      setMemberForm({ name: '', email: '', password: '', role: 'staff' })
      loadMembers()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingMember(false)
    }
  }

  const changeRole = async (membershipId, role) => {
    try {
      await tenantApi.updateMember(membershipId, { role })
      toast.success('Role updated')
      loadMembers()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const removeMember = async (membershipId) => {
    try {
      await tenantApi.removeMember(membershipId)
      toast.success('Member removed')
      loadMembers()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const createInvite = async () => {
    try {
      const result = await tenantApi.createInvite({ email: 'open', role: 'staff' })
      setInvite(result)
      toast.success('Invite code created')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const locationLimit = plan?.maxLocations ?? 1
  const staffLimit = plan?.maxStaff ?? 0

  const usage = useMemo(
    () => [
      { label: 'Branches', used: locations.length, limit: locationLimit },
      { label: 'Staff accounts', used: members.length, limit: staffLimit },
    ],
    [locations.length, members.length, locationLimit, staffLimit]
  )

  if (!tenant) return null

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Business settings</h2>
          <p className="text-sm text-slate-500">
            How {tenant.name} appears to customers and how your team works.
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'branding' && (
        <form onSubmit={saveBrand} className="card space-y-5 p-5 sm:p-6">
          <div className="flex items-center gap-4">
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
            ) : (
              <div
                className="flex h-16 w-16 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: brand.brandColor }}
              >
                <Building2 size={26} />
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-slate-900">Logo & colours</p>
              <p className="text-xs text-slate-500">
                Your logo and brand colour appear on every screen of the business.
              </p>
            </div>
          </div>

          {/* Public booking link */}
          <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
                <CalendarClock size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">Public booking page</p>
                <p className="text-xs text-slate-500">
                  Share this link with customers so they can book online.
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                readOnly
                className="input flex-1 bg-white text-xs"
                value={`${window.location.origin}/book/${tenant?.slug}`}
              />
              <button
                type="button"
                className="btn-secondary px-3 py-2 text-xs"
                onClick={() => {
                  navigator.clipboard?.writeText(`${window.location.origin}/book/${tenant?.slug}`)
                  toast.success('Link copied!')
                }}
              >
                Copy link
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Business name</label>
              <input
                className="input"
                value={brand.name}
                onChange={(e) => setBrand({ ...brand, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Logo URL</label>
              <input
                className="input"
                placeholder="https://…/logo.png"
                value={brand.logoUrl}
                onChange={(e) => setBrand({ ...brand, logoUrl: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label">Brand colour</label>
            <div className="flex flex-wrap items-center gap-2">
              {BRAND_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setBrand({ ...brand, brandColor: c })}
                  className="h-8 w-8 rounded-full ring-offset-2 transition-shadow"
                  style={{
                    backgroundColor: c,
                    boxShadow: brand.brandColor === c ? `0 0 0 2px ${c}` : 'none',
                  }}
                />
              ))}
              <input
                type="color"
                className="h-8 w-10 cursor-pointer rounded border border-slate-300"
                value={brand.brandColor}
                onChange={(e) => setBrand({ ...brand, brandColor: e.target.value })}
              />
              <input
                className="input w-28"
                value={brand.brandColor}
                onChange={(e) => setBrand({ ...brand, brandColor: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Phone</label>
              <input
                className="input"
                value={brand.phone}
                onChange={(e) => setBrand({ ...brand, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Address</label>
              <input
                className="input"
                value={brand.address}
                onChange={(e) => setBrand({ ...brand, address: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Currency</label>
              <input
                className="input"
                value={brand.currency}
                onChange={(e) => setBrand({ ...brand, currency: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Time zone</label>
              <input
                className="input"
                value={brand.timezone}
                onChange={(e) => setBrand({ ...brand, timezone: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Tax rate (%)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={brand.taxRate}
                onChange={(e) => setBrand({ ...brand, taxRate: e.target.value })}
              />
            </div>
          </div>

          <button type="submit" disabled={savingBrand} className="btn-primary">
            {savingBrand ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Save branding
          </button>
        </form>
      )}

      {tab === 'locations' && (
        <div className="card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Branches</h3>
              <p className="text-xs text-slate-500">
                {locations.length} of {locationLimit} used on the {plan?.name} plan.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setLocationForm({ name: '', code: '', address: '', city: '', phone: '' })
                setLocationModal({})
              }}
              disabled={locations.length >= locationLimit}
              className="btn-primary"
            >
              <Plus size={15} /> Add branch
            </button>
          </div>

          {locations.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="No branches yet"
              message="Add your first branch to start taking bookings and running the wash floor."
            />
          ) : (
            <div className="mt-4 space-y-2">
              {locations.map((l) => (
                <div
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{l.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {l.code} · {l.address || 'No address'} {l.city ? `· ${l.city}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!l.active && <Badge color="slate">inactive</Badge>}
                    <button
                      type="button"
                      onClick={() => {
                        setLocationForm({
                          name: l.name,
                          code: l.code,
                          address: l.address || '',
                          city: l.city || '',
                          phone: l.phone || '',
                        })
                        setLocationModal(l)
                      }}
                      className="btn-ghost px-2 py-1"
                    >
                      <Pencil size={14} />
                    </button>
                    {l.active && (
                      <button
                        type="button"
                        onClick={() => deactivateLocation(l.id)}
                        className="btn-ghost px-2 py-1 text-rose-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'team' && (
        <div className="card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Team</h3>
              <p className="text-xs text-slate-500">
                {members.length} of {staffLimit} staff accounts on the {plan?.name} plan.
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={createInvite} className="btn-secondary">
                <Copy size={15} /> Invite code
              </button>
              <button
                type="button"
                onClick={() => {
                  setMemberForm({ name: '', email: '', password: '', role: 'staff' })
                  setMemberModal({})
                }}
                className="btn-primary"
              >
                <Plus size={15} /> Add member
              </button>
            </div>
          </div>

          {invite && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm">
              <span className="text-slate-700">
                Share this code with your team member:{' '}
                <strong className="tracking-widest text-slate-900">{invite.code}</strong>
              </span>
              <button
                type="button"
                className="btn-secondary py-1 text-xs"
                onClick={() => {
                  navigator.clipboard?.writeText(invite.code)
                  toast.success('Code copied')
                }}
              >
                Copy
              </button>
            </div>
          )}

          <div className="mt-4 divide-y divide-slate-100">
            {loadingMembers ? (
              <p className="py-6 text-center text-sm text-slate-400">Loading team…</p>
            ) : (
              members.map((m) => (
                <div key={m.membershipId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">
                      {m.name}
                      {m.userId === user?._id && <span className="ml-1.5 text-xs text-slate-400">(you)</span>}
                    </p>
                    <p className="truncate text-xs text-slate-500">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.role === 'owner' ? (
                      <Badge color="purple">owner</Badge>
                    ) : (
                      <select
                        className="input w-32 py-1.5"
                        value={m.role}
                        onChange={(e) => changeRole(m.membershipId, e.target.value)}
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    )}
                    {m.status !== 'active' && <Badge color="red">{m.status}</Badge>}
                    {m.role !== 'owner' && m.userId !== user?._id && (
                      <button
                        type="button"
                        onClick={() => removeMember(m.membershipId)}
                        className="btn-ghost px-2 py-1 text-rose-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'plan' && (
        <div className="space-y-5">
          <div className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">{plan?.name || 'Starter'} plan</h3>
                <p className="text-xs text-slate-500">
                  {tenant.subscription?.status || 'active'} · renews{' '}
                  {tenant.subscription?.renewsAt
                    ? new Date(tenant.subscription.renewsAt).toLocaleDateString()
                    : '—'}
                </p>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                ${plan?.priceMonthly ?? 0}
                <span className="text-sm font-normal text-slate-500">/mo</span>
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {usage.map((u) => (
                <div key={u.label} className="rounded-xl border border-slate-200 px-4 py-3">
                  <p className="text-xs text-slate-500">{u.label}</p>
                  <p className="text-lg font-semibold text-slate-800">
                    {u.used} <span className="text-sm font-normal text-slate-400">/ {u.limit}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5 sm:p-6">
            <h3 className="font-semibold text-slate-900">What this plan unlocks</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                <div
                  key={key}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                    features[key] ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'
                  }`}
                >
                  {features[key] ? <Check size={15} /> : <span className="w-[15px]" />}
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Branch modal */}
      <Modal
        open={!!locationModal}
        onClose={() => setLocationModal(null)}
        title={locationModal?.id ? 'Edit branch' : 'Add branch'}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setLocationModal(null)}>
              Cancel
            </button>
            <button
              type="submit"
              form="location-form"
              disabled={savingLocation}
              className="btn-primary"
            >
              {savingLocation ? <Loader2 size={15} className="animate-spin" /> : 'Save branch'}
            </button>
          </>
        }
      >
        <form id="location-form" onSubmit={saveLocation} className="space-y-4">
          <div>
            <label className="label">Branch name</label>
            <input
              required
              className="input"
              placeholder="Downtown Branch"
              value={locationForm.name}
              onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Code</label>
              <input
                className="input"
                placeholder="DOWNTOWN"
                value={locationForm.code}
                onChange={(e) => setLocationForm({ ...locationForm, code: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                className="input"
                value={locationForm.phone}
                onChange={(e) => setLocationForm({ ...locationForm, phone: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <input
              className="input"
              value={locationForm.address}
              onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
            />
          </div>
          <div>
            <label className="label">City</label>
            <input
              className="input"
              value={locationForm.city}
              onChange={(e) => setLocationForm({ ...locationForm, city: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* Member modal */}
      <Modal
        open={!!memberModal}
        onClose={() => setMemberModal(null)}
        title="Add team member"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setMemberModal(null)}>
              Cancel
            </button>
            <button type="submit" form="member-form" disabled={savingMember} className="btn-primary">
              {savingMember ? <Loader2 size={15} className="animate-spin" /> : 'Add member'}
            </button>
          </>
        }
      >
        <form id="member-form" onSubmit={saveMember} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              placeholder="Sam Lee"
              value={memberForm.name}
              onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              required
              type="email"
              className="input"
              placeholder="sam@yourwash.com"
              value={memberForm.email}
              onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              placeholder="Only for brand new accounts"
              value={memberForm.password}
              onChange={(e) => setMemberForm({ ...memberForm, password: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Role</label>
            <select
              className="input"
              value={memberForm.role}
              onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default BusinessSettings
