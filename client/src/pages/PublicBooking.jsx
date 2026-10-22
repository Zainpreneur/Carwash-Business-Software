import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Droplets,
  CalendarClock,
  Car,
  User,
  Phone,
  Mail,
  Check,
  ArrowRight,
  ArrowLeft,
  Clock,
  MapPin,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import apiClient from '../api/client'

const PublicBooking = () => {
  const { slug } = useParams()
  const navigate = useNavigate()

  const [business, setBusiness] = useState(null)
  const [services, setServices] = useState([])
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Booking flow state
  const [step, setStep] = useState(1) // 1: services, 2: datetime, 3: details, 4: confirm
  const [selectedServices, setSelectedServices] = useState([])
  const [selectedPackage, setSelectedPackage] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [slots, setSlots] = useState([])
  const [slotSummary, setSlotSummary] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '', plate: '', make: '', model: '' })
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState(null)

  // Load business info + services
  useEffect(() => {
    Promise.all([
      apiClient.get(`/public/${slug}/info`),
      apiClient.get(`/public/${slug}/services`),
    ])
      .then(([info, svcs]) => {
        setBusiness(info.data)
        setServices(svcs.data.services || [])
        setPackages(svcs.data.packages || [])
      })
      .catch((err) => {
        setError(err?.response?.data?.message || 'Business not found')
      })
      .finally(() => setLoading(false))
  }, [slug])

  // Load availability when date changes
  useEffect(() => {
    if (!selectedDate) return
    setSlotsLoading(true)
    apiClient
      .get(`/public/${slug}/availability`, { params: { date: selectedDate } })
      .then((res) => {
        setSlots(res.data.slots || [])
        setSlotSummary(res.data.summary || null)
      })
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false))
  }, [slug, selectedDate])

  const toggleService = (svc) => {
    setSelectedServices((prev) =>
      prev.find((s) => s._id === svc._id)
        ? prev.filter((s) => s._id !== svc._id)
        : [...prev, svc]
    )
  }

  const totalDuration = selectedServices.reduce((sum, s) => sum + (s.durationMinutes || 30), 0)
  const totalPrice = selectedServices.reduce((sum, s) => sum + (s.price || 0), 0)

  const canProceed = () => {
    if (step === 1) return selectedServices.length > 0 || selectedPackage
    if (step === 2) return selectedSlot
    if (step === 3) return customer.name && customer.phone
    return true
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const res = await apiClient.post(`/public/${slug}/bookings`, {
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email,
        vehiclePlate: customer.plate,
        vehicleMake: customer.make,
        vehicleModel: customer.model,
        serviceIds: selectedServices.map((s) => s._id),
        scheduledAt: selectedSlot.datetime,
        notes,
      })
      setConfirmation(res.data)
      setStep(4)
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to create booking')
    } finally {
      setSubmitting(false)
    }
  }

  const brandColor = business?.brandColor || '#0284c7'

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-4 text-center">
        <AlertCircle size={48} className="text-rose-400" />
        <h1 className="mt-4 text-xl font-bold text-slate-900">Business not found</h1>
        <p className="mt-2 text-sm text-slate-500">{error}</p>
      </div>
    )
  }

  // Step 4: Confirmation
  if (step === 4 && confirmation) {
    return (
      <div className="min-h-dvh bg-gradient-to-br from-emerald-50 to-white px-4 py-12">
        <div className="mx-auto max-w-lg text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 size={40} className="text-emerald-600" />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-slate-900">Booking Confirmed!</h1>
          <p className="mt-2 text-slate-600">
            Thank you, {confirmation.customer}. Your wash is booked.
          </p>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Booking #</span>
                <span className="font-semibold text-slate-900">{confirmation.bookingNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Status</span>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  {confirmation.status}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Date & Time</span>
                <span className="font-medium text-slate-900">
                  {new Date(confirmation.scheduledAt).toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Services</span>
                <span className="font-medium text-slate-900">{selectedServices.map((s) => s.name).join(', ')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Estimated duration</span>
                <span className="font-medium text-slate-900">{totalDuration} min</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-3 text-sm">
                <span className="font-semibold text-slate-900">Total</span>
                <span className="text-lg font-bold text-slate-900">${totalPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <p className="mt-6 text-sm text-slate-500">
            We'll send you a confirmation shortly. You can check your booking status anytime.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() => navigate(`/book/${slug}`)}
              className="btn-secondary"
            >
              Book another wash
            </button>
            <a
              href={`tel:${business?.phone}`}
              className="btn-primary"
            >
              <Phone size={15} /> Call us
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      {/* Header */}
      <header
        className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6"
        style={{ borderTopColor: brandColor, borderTopWidth: 4 }}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          {business?.logoUrl ? (
            <img src={business.logoUrl} alt={business.name} className="h-10 w-10 rounded-xl object-cover" />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
              style={{ backgroundColor: brandColor }}
            >
              <Droplets size={20} />
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold text-slate-900">{business?.name}</h1>
            <p className="text-xs text-slate-500">Book your wash online</p>
          </div>
          {business?.phone && (
            <a
              href={`tel:${business.phone}`}
              className="ml-auto flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
            >
              <Phone size={13} /> {business.phone}
            </a>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {/* Progress steps */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {['Services', 'Date & Time', 'Your Details'].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  step > i + 1
                    ? 'bg-emerald-500 text-white'
                    : step === i + 1
                    ? 'text-white shadow-md'
                    : 'bg-slate-200 text-slate-500'
                }`}
                style={step === i + 1 ? { backgroundColor: brandColor } : {}}
              >
                {step > i + 1 ? <Check size={14} /> : i + 1}
              </div>
              <span
                className={`hidden text-xs font-medium sm:inline ${
                  step === i + 1 ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                {label}
              </span>
              {i < 2 && <div className="h-0.5 w-6 bg-slate-200 sm:w-10" />}
            </div>
          ))}
        </div>

        {/* Step 1: Services */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Choose your services</h2>
            <p className="text-sm text-slate-500">Select one or more services for your wash.</p>

            <div className="space-y-2">
              {services.map((svc) => {
                const selected = selectedServices.find((s) => s._id === svc._id)
                return (
                  <button
                    key={svc._id}
                    onClick={() => toggleService(svc)}
                    className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all ${
                      selected
                        ? 'border-brand-500 bg-brand-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                    }`}
                    style={selected ? { borderColor: brandColor, backgroundColor: `${brandColor}10` } : {}}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all ${
                          selected ? 'border-transparent text-white' : 'border-slate-300'
                        }`}
                        style={selected ? { backgroundColor: brandColor } : {}}
                      >
                        {selected && <Check size={12} />}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{svc.name}</p>
                        {svc.description && (
                          <p className="text-xs text-slate-500">{svc.description}</p>
                        )}
                        <p className="mt-0.5 text-xs text-slate-400">{svc.durationMinutes} min</p>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-slate-900">${Number(svc.price).toFixed(2)}</span>
                  </button>
                )
              })}
            </div>

            {packages.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-semibold text-slate-700">Or choose a package</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {packages.map((pkg) => (
                    <button
                      key={pkg._id}
                      onClick={() => {
                        setSelectedPackage(pkg)
                        setSelectedServices([])
                      }}
                      className={`rounded-xl border p-4 text-left transition-all ${
                        selectedPackage?._id === pkg._id
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <p className="font-medium text-slate-900">{pkg.name}</p>
                      {pkg.description && <p className="text-xs text-slate-500">{pkg.description}</p>}
                      <p className="mt-1 text-xs text-slate-400">{pkg.durationMinutes} min</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedServices.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">
                    {selectedServices.length} service{selectedServices.length > 1 ? 's' : ''} · {totalDuration} min
                  </span>
                  <span className="text-lg font-bold text-slate-900">${totalPrice.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Date & Time */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Pick a date & time</h2>

            <div>
              <label className="label">Date</label>
              <input
                type="date"
                className="input"
                min={new Date().toISOString().split('T')[0]}
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value)
                  setSelectedSlot(null)
                }}
              />
            </div>

            {selectedDate && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <label className="label mb-0">Time slots</label>
                  {slotSummary && (
                    <span className="text-xs text-slate-500">
                      {slotSummary.available} available · {slotSummary.booked} booked
                    </span>
                  )}
                </div>
                {/* Legend */}
                <div className="mb-3 flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded border border-slate-300 bg-white" />
                    Available
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded bg-slate-200" />
                    Booked
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded" style={{ backgroundColor: brandColor }} />
                    Selected
                  </span>
                </div>
                {slotsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {slots.map((slot) => (
                      <button
                        key={slot.time}
                        disabled={!slot.available}
                        onClick={() => setSelectedSlot(slot)}
                        className={`relative rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                          !slot.available
                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                            : selectedSlot?.time === slot.time
                            ? 'border-transparent text-white shadow-md'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:shadow-sm'
                        }`}
                        style={
                          selectedSlot?.time === slot.time && slot.available
                            ? { backgroundColor: brandColor }
                            : {}
                        }
                      >
                        <span className="block">{slot.time}</span>
                        {!slot.available && (
                          <span className="block text-[10px] font-normal text-slate-400">
                            Booked
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {slots.length > 0 && slots.every((s) => !s.available) && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
                    <p className="text-sm font-medium text-amber-800">
                      All slots are booked for this date.
                    </p>
                    <p className="mt-1 text-xs text-amber-600">
                      Try selecting a different date.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Customer Details */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Your details</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Full name *</label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    className="input pl-9"
                    placeholder="John Smith"
                    value={customer.name}
                    onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="label">Phone number *</label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    type="tel"
                    className="input pl-9"
                    placeholder="555-0123"
                    value={customer.phone}
                    onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Email (optional)</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    className="input pl-9"
                    placeholder="john@example.com"
                    value={customer.email}
                    onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Vehicle (optional)</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="label">License plate</label>
                  <div className="relative">
                    <Car size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      className="input pl-9"
                      placeholder="ABC-1234"
                      value={customer.plate}
                      onChange={(e) => setCustomer({ ...customer, plate: e.target.value.toUpperCase() })}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Make</label>
                  <input
                    className="input"
                    placeholder="Toyota"
                    value={customer.make}
                    onChange={(e) => setCustomer({ ...customer, make: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Model</label>
                  <input
                    className="input"
                    placeholder="Camry"
                    value={customer.model}
                    onChange={(e) => setCustomer({ ...customer, model: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="label">Notes (optional)</label>
              <textarea
                className="input"
                rows={3}
                placeholder="Any special requests or instructions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Summary */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Booking summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Services</span>
                  <span className="font-medium text-slate-900">
                    {selectedServices.map((s) => s.name).join(', ') || selectedPackage?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date & Time</span>
                  <span className="font-medium text-slate-900">
                    {selectedSlot
                      ? new Date(selectedSlot.datetime).toLocaleString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Duration</span>
                  <span className="font-medium text-slate-900">{totalDuration} min</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2">
                  <span className="font-semibold text-slate-900">Total</span>
                  <span className="text-lg font-bold text-slate-900">${totalPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-6 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="btn-secondary"
            >
              <ArrowLeft size={15} /> Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="btn-primary"
            >
              Continue <ArrowRight size={15} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canProceed() || submitting}
              className="btn-primary"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {submitting ? 'Booking...' : 'Confirm booking'}
            </button>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-4 py-4 text-center text-xs text-slate-400">
        Powered by SudsFlow · {business?.name}
      </footer>
    </div>
  )
}

export default PublicBooking
