import clsx from 'clsx'

const palettes = {
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-blue-100 text-blue-700',
  amber: 'bg-amber-100 text-amber-700',
  green: 'bg-emerald-100 text-emerald-700',
  red: 'bg-rose-100 text-rose-700',
  purple: 'bg-violet-100 text-violet-700',
  cyan: 'bg-cyan-100 text-cyan-700',
}

const statusColor = {
  pending: 'amber',
  confirmed: 'blue',
  'in-progress': 'purple',
  completed: 'green',
  cancelled: 'red',
  paid: 'green',
  unpaid: 'amber',
  partial: 'cyan',
  refunded: 'slate',
  active: 'green',
  inactive: 'slate',
  admin: 'purple',
  manager: 'blue',
  staff: 'slate',
  // wash-order lifecycle (carwash-compile/01-foundation/data-model.md)
  queued: 'amber',
  'bay-assigned': 'blue',
  'in-wash': 'purple',
  'quality-check': 'cyan',
  'ready-for-pickup': 'green',
  pass: 'green',
  fail: 'red',
  operational: 'green',
  degraded: 'amber',
  down: 'red',
  retired: 'slate',
  // ticket lifecycle (04-growth/crm.md)
  open: 'amber',
  'waiting-on-customer': 'cyan',
  resolved: 'green',
  closed: 'slate',
  // ticket priority
  low: 'slate',
  normal: 'blue',
  high: 'amber',
  urgent: 'red',
  // employee lifecycle (03-operations/hr.md)
  applicant: 'slate',
  hired: 'blue',
  onboarding: 'cyan',
  'on-leave': 'amber',
  offboarded: 'slate',
  // shift status
  scheduled: 'blue',
  'no-show': 'red',
  // leave request decision
  approved: 'green',
  denied: 'red',
  // membership subscription lifecycle (01-foundation/data-model.md)
  'past-due': 'amber',
  suspended: 'red',
  paused: 'cyan',
  // purchase order lifecycle (03-operations/inventory.md)
  draft: 'slate',
  sent: 'blue',
  'partially-received': 'amber',
  received: 'cyan',
  // fleet inquiry status (04-growth/marketing.md)
  new: 'blue',
  'followed-up': 'cyan',
  converted: 'green',
  declined: 'slate',
  // review-response-agent status
  'auto-responded': 'green',
  escalated: 'red',
  // customer segments
  'active-member': 'green',
  'at-risk-member': 'amber',
  'active-pay-per-wash': 'blue',
  'at-risk-pay-per-wash': 'amber',
  lapsed: 'slate',
  'fleet-commercial': 'purple',
}

const Badge = ({ children, color, status, className = '' }) => {
  const resolved = color || statusColor[status] || 'slate'
  return (
    <span className={clsx('badge', palettes[resolved], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  )
}

export default Badge
