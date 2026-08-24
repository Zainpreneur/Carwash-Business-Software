import { useEffect, useRef, useState } from 'react'
import { createWorker } from 'tesseract.js'
import {
  Camera,
  CameraOff,
  ScanLine,
  Loader2,
  Search,
  Car,
  Phone,
  Mail,
  MapPin,
  StickyNote,
  CalendarPlus,
  Upload,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'
import Badge from '../ui/Badge'
import EmptyState from '../ui/EmptyState'
import BookingFormModal from '../bookings/BookingFormModal'
import { vehiclesApi } from '../../api/resources'
import { getErrorMessage } from '../../api/client'

// OCR worker is created once and reused across scans.
let workerPromise = null
const getWorker = () => {
  if (!workerPromise) workerPromise = createWorker('eng')
  return workerPromise
}

const extractPlateCandidates = (text) => {
  const tokens = String(text || '').toUpperCase().split(/[^A-Z0-9]+/)
  const seen = new Set()
  return tokens.filter((t) => {
    if (t.length < 4 || t.length > 9) return false
    if (seen.has(t)) return false
    seen.add(t)
    return /\d/.test(t) && /[A-Z]/.test(t)
  })
}

const PlateScanner = ({ open, onClose }) => {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fileInputRef = useRef(null)

  const [cameraOn, setCameraOn] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [plateInput, setPlateInput] = useState('')
  const [candidates, setCandidates] = useState([])
  const [lookupLoading, setLookupLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [notFound, setNotFound] = useState('')
  const [bookingOpen, setBookingOpen] = useState(false)

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOn(false)
  }

  useEffect(() => {
    if (!open) {
      stopCamera()
      setResult(null)
      setNotFound('')
      setPlateInput('')
      setCandidates([])
      setScanning(false)
      setBookingOpen(false)
    }
    return () => {
      if (!open) stopCamera()
    }
  }, [open])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraOn(true)
    } catch {
      toast.error('Camera unavailable — use a photo instead')
    }
  }

  const runOcr = async (imageSource) => {
    setScanning(true)
    setResult(null)
    setNotFound('')
    try {
      const worker = await getWorker()
      const { data } = await worker.recognize(imageSource)
      const found = extractPlateCandidates(data.text).slice(0, 4)
      setCandidates(found)
      if (found.length) {
        setPlateInput(found[0])
        lookup(found[0])
      } else {
        toast.error('No plate text detected — enter it manually below')
      }
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setScanning(false)
    }
  }

  const captureFrame = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    runOcr(canvas.toDataURL('image/jpeg'))
  }

  const onFilePicked = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    runOcr(file)
  }

  const lookup = async (plate) => {
    const value = String(plate || plateInput).trim()
    if (!value) return toast.error('Enter or scan a plate number first')
    setLookupLoading(true)
    setNotFound('')
    try {
      const data = await vehiclesApi.lookupPlate(value)
      setResult(data)
    } catch (err) {
      setResult(null)
      setNotFound(getErrorMessage(err))
    } finally {
      setLookupLoading(false)
    }
  }

  const openBooking = () => {
    stopCamera()
    setBookingOpen(true)
  }

  return (
    <>
      <Modal open={open && !bookingOpen} onClose={onClose} title="Scan number plate" size="lg">
        <div className="space-y-4">
          {/* Camera / capture area */}
          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`h-56 w-full object-cover sm:h-72 ${cameraOn ? '' : 'hidden'}`}
            />
            {!cameraOn && (
              <div className="flex h-56 flex-col items-center justify-center gap-2 text-slate-400 sm:h-72">
                <ScanLine size={36} />
                <p className="text-sm">Point the camera at the vehicle&apos;s plate</p>
              </div>
            )}
            {(scanning || cameraOn) && (
              <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2 border-brand-400/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]" />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {cameraOn ? (
              <>
                <button className="btn-primary" onClick={captureFrame} disabled={scanning}>
                  {scanning ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />}
                  {scanning ? 'Scanning…' : 'Capture & scan'}
                </button>
                <button className="btn-secondary" onClick={stopCamera}>
                  <CameraOff size={16} /> Stop camera
                </button>
              </>
            ) : (
              <button className="btn-primary" onClick={startCamera}>
                <Camera size={16} /> Start camera
              </button>
            )}
            <button className="btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={scanning}>
              <Upload size={16} /> From photo
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" hidden onChange={onFilePicked} />
          </div>

          {/* Manual entry / OCR result */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              lookup()
            }}
            className="flex gap-2"
          >
            <input
              className="input flex-1 font-mono uppercase"
              placeholder="e.g. ABC1234"
              value={plateInput}
              onChange={(e) => setPlateInput(e.target.value.toUpperCase())}
            />
            <button className="btn-primary shrink-0" type="submit" disabled={lookupLoading}>
              {lookupLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Lookup
            </button>
          </form>

          {candidates.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-500">Detected:</span>
              {candidates.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setPlateInput(c)
                    lookup(c)
                  }}
                  className={`rounded-full border px-3 py-1 font-mono text-xs ${
                    c === plateInput ? 'border-brand-400 bg-brand-50 text-brand-600' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {notFound && !result && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">{notFound}</div>}

          {/* Customer result */}
          {result && (
            <div className="space-y-4 rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold text-slate-900">{result.customer.name}</h4>
                  <div className="mt-1.5 space-y-0.5 text-sm text-slate-500">
                    <p className="flex items-center gap-1.5"><Phone size={13} /> {result.customer.phone}</p>
                    {result.customer.email && (
                      <p className="flex items-center gap-1.5"><Mail size={13} /> {result.customer.email}</p>
                    )}
                    {result.customer.address && (
                      <p className="flex items-center gap-1.5"><MapPin size={13} /> {result.customer.address}</p>
                    )}
                  </div>
                </div>
                <span className="rounded-lg bg-slate-900 px-3 py-1.5 font-mono text-sm font-semibold tracking-wider text-white">
                  {result.vehicle.plateNumber}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-lg font-semibold text-slate-900">{result.customer.visitCount}</p>
                  <p className="text-xs text-slate-500">Visits</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-lg font-semibold text-slate-900">${Number(result.customer.totalSpent || 0).toFixed(2)}</p>
                  <p className="text-xs text-slate-500">Total spent</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-lg font-semibold text-slate-900">{result.customer.loyaltyPoints}</p>
                  <p className="text-xs text-slate-500">Loyalty pts</p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <p className="flex items-center gap-1.5 font-medium text-slate-800">
                  <Car size={14} /> Scanned vehicle
                </p>
                <p className="mt-0.5 text-slate-500">
                  {result.vehicle.year} {result.vehicle.make} {result.vehicle.model} · <span className="capitalize">{result.vehicle.type}</span>
                  {result.vehicle.color ? ` · ${result.vehicle.color}` : ''}
                </p>
              </div>

              {result.customer.notes && (
                <p className="flex items-start gap-1.5 text-sm text-slate-500">
                  <StickyNote size={14} className="mt-0.5 shrink-0" /> {result.customer.notes}
                </p>
              )}

              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-800">Recent bookings</h4>
                {result.customer.recentBookings?.length ? (
                  <div className="space-y-2">
                    {result.customer.recentBookings.slice(0, 3).map((b) => (
                      <div key={b._id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium text-slate-800">{b.bookingNumber}</p>
                          <p className="text-xs text-slate-500">{b.vehicle ? `${b.vehicle.make} ${b.vehicle.model}` : ''}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">${Number(b.total).toFixed(2)}</span>
                          <Badge status={b.status}>{b.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No bookings yet" />
                )}
              </div>

              <div className="flex justify-end">
                <button className="btn-primary" onClick={openBooking}>
                  <CalendarPlus size={16} /> New booking for this customer
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <BookingFormModal
        open={bookingOpen}
        onClose={() => {
          setBookingOpen(false)
          onClose()
        }}
        onSaved={() => {
          setBookingOpen(false)
          onClose()
        }}
        prefill={result ? { customer: result.customer, vehicleId: result.vehicle._id } : undefined}
      />
    </>
  )
}

export default PlateScanner
