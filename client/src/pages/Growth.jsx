import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { Plus, Users2, Truck, Star, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { growthApi } from '../api/resources'
import { getErrorMessage } from '../api/client'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'

// Growth cluster (04-growth/marketing.md, 04-growth/social-media.md). Customer segmentation
// is computed live from real data; fleet-lead-scorer and review-response-agent are both
// real, deterministic agents (no Claude call — see their own file headers) working off
// manually-logged inquiries/reviews, since this app has no live ad-platform or Google
// Business Profile connector to detect them automatically. Not built: the content-calendar
// publishing pipeline, paid ad campaigns, A/B testing, and multi-week lifecycle drip
// follow-ups (all need a scheduler or a real ad/social API this app doesn't have).
const SEGMENT_LABEL = {
  new: 'New',
  'active-pay-per-wash': 'Active Pay-Per-Wash',
  'active-member': 'Active Member',
  'at-risk-member': 'At-Risk Member',
  'at-risk-pay-per-wash': 'At-Risk Pay-Per-Wash',
  lapsed: 'Lapsed',
  'fleet-commercial': 'Fleet/Commercial',
}
const SEGMENT_ORDER = ['new', 'active-pay-per-wash', 'active-member', 'at-risk-member', 'at-risk-pay-per-wash', 'lapsed', 'fleet-commercial']

const TABS = [
  { key: 'segments', label: 'Segments', icon: Users2 },
  { key: 'fleet', label: 'Fleet Inquiries', icon: Truck },
  { key: 'reviews', label: 'Reviews', icon: Star },
]

const emptyFleetForm = { companyName: '', contactPhone: '', vehicleCountRequested: '', contactPattern: 'business-hours', invoicingTermsRequested: false }
const emptyReviewForm = { source: 'google-business-profile', rating: 5, text: '' }

const Growth = () => {
  const [tab, setTab] = useState('segments')
  const [summary, setSummary] = useState(null)
  const [segmentDetail, setSegmentDetail] = useState(null)
  const [inquiries, setInquiries] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  const [fleetModalOpen, setFleetModalOpen] = useState(false)
  const [fleetForm, setFleetForm] = useState(emptyFleetForm)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewForm, setReviewForm] = useState(emptyReviewForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([growthApi.segmentSummary(), growthApi.fleetInquiries.list(), growthApi.reviews.list()])
      .then(([s, f, r]) => {
        setSummary(s)
        setInquiries(f)
        setReviews(r)
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const viewSegment = async (segment) => {
    try {
      const customers = await growthApi.segmentedCustomers(segment)
      setSegmentDetail({ segment, customers })
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const submitFleetInquiry = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await growthApi.fleetInquiries.create({ ...fleetForm, vehicleCountRequested: Number(fleetForm.vehicleCountRequested) })
      toast.success('Fleet inquiry scored and logged')
      setFleetModalOpen(false)
      setFleetForm(emptyFleetForm)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const updateInquiryStatus = async (id, status) => {
    try {
      await growthApi.fleetInquiries.updateStatus(id, status)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const submitReview = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await growthApi.reviews.create({ ...reviewForm, rating: Number(reviewForm.rating) })
      toast.success('Review logged and processed')
      setReviewModalOpen(false)
      setReviewForm(emptyReviewForm)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading || !summary) return <Spinner full />

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

      {tab === 'segments' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {SEGMENT_ORDER.map((seg) => (
              <button key={seg} onClick={() => viewSegment(seg)} className="card p-4 text-left transition hover:border-brand-300 hover:shadow-sm">
                <p className="text-2xl font-semibold text-slate-900">{summary[seg] || 0}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><Badge status={seg}>{SEGMENT_LABEL[seg]}</Badge></p>
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400">Segments are computed live from real wash/membership history — no lifecycle-drip campaigns are wired to them yet (needs a scheduler this app doesn't have).</p>
        </div>
      )}

      {tab === 'fleet' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button className="btn-primary" onClick={() => setFleetModalOpen(true)}><Plus size={16} /> Log fleet inquiry</button>
          </div>
          {inquiries.length === 0 ? (
            <div className="card"><EmptyState icon={Truck} title="No fleet inquiries yet" /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Company</th><th>Vehicles</th><th>Contact</th><th>Invoicing</th><th>Score</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {inquiries.map((i) => (
                      <tr key={i._id}>
                        <td className="font-medium text-slate-800">{i.companyName}</td>
                        <td>{i.vehicleCountRequested}</td>
                        <td className="capitalize text-xs text-slate-500">{i.contactPattern.replace('-', ' ')}</td>
                        <td>{i.invoicingTermsRequested ? 'Yes' : 'No'}</td>
                        <td className={i.score >= 50 ? 'font-semibold text-emerald-600' : 'text-slate-600'}>{i.score}/100</td>
                        <td><Badge status={i.status}>{i.status.replace('-', ' ')}</Badge></td>
                        <td>
                          {i.status === 'new' && (
                            <div className="flex gap-1.5">
                              <button className="btn-secondary py-1 text-xs" onClick={() => updateInquiryStatus(i._id, 'followed-up')}>Followed up</button>
                              <button className="btn-secondary py-1 text-xs" onClick={() => updateInquiryStatus(i._id, 'declined')}>Decline</button>
                            </div>
                          )}
                          {i.status === 'followed-up' && (
                            <button className="btn-secondary py-1 text-xs" onClick={() => updateInquiryStatus(i._id, 'converted')}>Mark converted</button>
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

      {tab === 'reviews' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button className="btn-primary" onClick={() => setReviewModalOpen(true)}><Plus size={16} /> Log review</button>
          </div>
          {reviews.length === 0 ? (
            <div className="card"><EmptyState icon={Star} title="No reviews logged yet" /></div>
          ) : (
            <div className="space-y-2">
              {reviews.map((r) => (
                <div key={r._id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={14} className={i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />
                      ))}
                      <span className="ml-2 text-xs capitalize text-slate-400">{r.source.replace(/-/g, ' ')}</span>
                    </div>
                    <Badge status={r.status}>{r.status.replace('-', ' ')}</Badge>
                  </div>
                  {r.text && <p className="mt-2 text-sm text-slate-700">{r.text}</p>}
                  {r.response && <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{r.response}</p>}
                  <p className="mt-2 text-xs text-slate-400">{r.customer?.name || 'Anonymous'} · {format(new Date(r.createdAt), 'MMM d, yyyy')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Log fleet inquiry */}
      <Modal open={fleetModalOpen} onClose={() => setFleetModalOpen(false)} title="Log fleet inquiry">
        <form id="fleet-form" onSubmit={submitFleetInquiry} className="space-y-3">
          <div><label className="label">Company name</label><input className="input" value={fleetForm.companyName} onChange={(e) => setFleetForm({ ...fleetForm, companyName: e.target.value })} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Contact phone</label><input className="input" value={fleetForm.contactPhone} onChange={(e) => setFleetForm({ ...fleetForm, contactPhone: e.target.value })} /></div>
            <div><label className="label">Vehicle count requested</label><input type="number" className="input" value={fleetForm.vehicleCountRequested} onChange={(e) => setFleetForm({ ...fleetForm, vehicleCountRequested: e.target.value })} required /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Contact pattern</label>
              <select className="input" value={fleetForm.contactPattern} onChange={(e) => setFleetForm({ ...fleetForm, contactPattern: e.target.value })}>
                <option value="business-hours">Business hours</option>
                <option value="after-hours">After hours</option>
              </select>
            </div>
            <label className="mt-6 flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={fleetForm.invoicingTermsRequested} onChange={(e) => setFleetForm({ ...fleetForm, invoicingTermsRequested: e.target.checked })} />
              Requested invoicing terms
            </label>
          </div>
        </form>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => setFleetModalOpen(false)}>Cancel</button>
          <button type="submit" form="fleet-form" className="btn-primary" disabled={saving}>{saving ? 'Scoring…' : 'Score & log'}</button>
        </div>
      </Modal>

      {/* Log review */}
      <Modal open={reviewModalOpen} onClose={() => setReviewModalOpen(false)} title="Log review">
        <form id="review-form" onSubmit={submitReview} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Source</label>
              <select className="input" value={reviewForm.source} onChange={(e) => setReviewForm({ ...reviewForm, source: e.target.value })}>
                {['google-business-profile', 'instagram', 'facebook', 'tiktok', 'manual'].map((s) => <option key={s} value={s}>{s.replace(/-/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Rating</label>
              <select className="input" value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: e.target.value })}>
                {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} star{r > 1 ? 's' : ''}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Review text</label><textarea className="input" rows={3} value={reviewForm.text} onChange={(e) => setReviewForm({ ...reviewForm, text: e.target.value })} /></div>
          <p className="text-xs text-slate-400">4-5 stars with no damage/injury/billing mention auto-thanks with a loyalty-point credit; anything else opens a support ticket and alerts staff.</p>
        </form>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => setReviewModalOpen(false)}>Cancel</button>
          <button type="submit" form="review-form" className="btn-primary" disabled={saving}>{saving ? 'Processing…' : 'Log review'}</button>
        </div>
      </Modal>

      {/* Segment detail */}
      <Modal open={!!segmentDetail} onClose={() => setSegmentDetail(null)} title={segmentDetail ? SEGMENT_LABEL[segmentDetail.segment] : ''} size="lg">
        {segmentDetail && (
          segmentDetail.customers.length === 0 ? (
            <EmptyState icon={TrendingUp} title="No customers in this segment" />
          ) : (
            <div className="max-h-96 space-y-1.5 overflow-y-auto">
              {segmentDetail.customers.map((c) => (
                <div key={c._id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span className="font-medium text-slate-800">{c.name}</span>
                  <span className="text-xs text-slate-400">{c.phone} · {c.visitCount} visits</span>
                </div>
              ))}
            </div>
          )
        )}
      </Modal>
    </div>
  )
}

export default Growth
