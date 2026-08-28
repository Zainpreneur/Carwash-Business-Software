import { format } from 'date-fns'
import { Printer } from 'lucide-react'
import Modal from '../ui/Modal'

// Renders the three generated-document types from server/src/services/documentService.js
// (06-platform/knowledge-base.md's "generated from" document types). No PDF file — a
// print-styled view the browser's own print dialog turns into a PDF, which is the
// deterministic-render behavior the spec actually asks for without adding a PDF-rendering
// dependency for three simple templates.
const currency = (n) => `$${Number(n || 0).toFixed(2)}`

const WashReceipt = ({ doc }) => (
  <div className="space-y-3 text-sm">
    <div className="text-center">
      <p className="font-semibold text-slate-900">SplashPoint Express Wash</p>
      <p className="text-xs text-slate-400">Wash Receipt · {doc.orderNumber}</p>
      <p className="text-xs text-slate-400">{format(new Date(doc.issuedAt), 'MMM d, yyyy h:mm a')}</p>
    </div>
    <div className="space-y-1 border-y border-dashed border-slate-200 py-3">
      <div className="flex justify-between"><span className="text-slate-500">Customer</span><span>{doc.customerName}</span></div>
      <div className="flex justify-between"><span className="text-slate-500">Vehicle</span><span>{doc.vehicle}</span></div>
      <div className="flex justify-between"><span className="text-slate-500">Package</span><span>{doc.packageName}</span></div>
      <div className="flex justify-between"><span className="text-slate-500">Payment method</span><span className="capitalize">{doc.paymentMethod.replace('-', ' ')}</span></div>
    </div>
    <div className="space-y-1">
      <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{currency(doc.subtotal)}</span></div>
      <div className="flex justify-between"><span className="text-slate-500">Tax ({(doc.taxRate * 100).toFixed(0)}%)</span><span>{currency(doc.tax)}</span></div>
      <div className="flex justify-between text-base font-semibold text-slate-900"><span>Total</span><span>{currency(doc.total)}</span></div>
    </div>
    <p className="text-center text-xs text-slate-400">Thank you for washing with us!</p>
  </div>
)

const MembershipAgreement = ({ doc }) => (
  <div className="space-y-3 text-sm">
    <div>
      <p className="font-semibold text-slate-900">Membership Agreement — {doc.planName}</p>
      <p className="text-xs text-slate-400">Signed up {format(new Date(doc.signedAt), 'MMM d, yyyy')} · status: {doc.status}</p>
    </div>
    <div className="space-y-1 rounded-lg border border-slate-200 p-3">
      <div className="flex justify-between"><span className="text-slate-500">Member</span><span>{doc.customerName}</span></div>
      <div className="flex justify-between"><span className="text-slate-500">Vehicle</span><span>{doc.vehicle}</span></div>
      <div className="flex justify-between"><span className="text-slate-500">Plan tier</span><span className="capitalize">{doc.planTier}</span></div>
      <div className="flex justify-between"><span className="text-slate-500">Monthly price</span><span>{currency(doc.monthlyPrice)}</span></div>
      <div className="flex justify-between"><span className="text-slate-500">Billing day</span><span>Day {doc.billingDayOfMonth} of each month</span></div>
    </div>
    <div>
      <p className="mb-1 font-medium text-slate-700">Terms</p>
      <ul className="list-disc space-y-1 pl-5 text-slate-600">
        {doc.terms.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    </div>
  </div>
)

const PackageComparison = ({ doc }) => (
  <div className="space-y-3 text-sm">
    <p className="text-xs text-slate-400">Generated {format(new Date(doc.generatedAt), 'MMM d, yyyy h:mm a')}</p>
    <div className="overflow-x-auto">
      <table className="table">
        <thead><tr><th>Package</th><th>Tier</th><th>Lane</th><th>Pricing by vehicle type</th></tr></thead>
        <tbody>
          {doc.packages.map((p) => (
            <tr key={p.name}>
              <td className="font-medium text-slate-800">{p.name}</td>
              <td className="capitalize">{p.tier}</td>
              <td className="capitalize">{p.lane?.replace('-', ' ')}</td>
              <td>{Object.entries(p.pricingByVehicleType).map(([vt, price]) => `${vt}: ${currency(price)}`).join(' · ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)

const RENDERERS = {
  'wash-receipt': WashReceipt,
  'membership-agreement': MembershipAgreement,
  'wash-package-comparison': PackageComparison,
}

const TITLES = {
  'wash-receipt': 'Wash Receipt',
  'membership-agreement': 'Membership Agreement',
  'wash-package-comparison': 'Wash Package Comparison',
}

const DocumentViewer = ({ open, onClose, doc }) => {
  const Renderer = doc && RENDERERS[doc.type]
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={doc ? TITLES[doc.type] : ''}
      size={doc?.type === 'wash-package-comparison' ? 'xl' : 'md'}
      footer={
        <button className="btn-secondary" onClick={() => window.print()}>
          <Printer size={15} /> Print
        </button>
      }
    >
      <div id="document-viewer-print-area">{Renderer && <Renderer doc={doc} />}</div>
    </Modal>
  )
}

export default DocumentViewer
