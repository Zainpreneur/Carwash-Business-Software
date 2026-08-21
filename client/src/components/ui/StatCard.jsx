import clsx from 'clsx'

const tones = {
  brand: 'bg-brand-50 text-brand-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  purple: 'bg-violet-50 text-violet-600',
  rose: 'bg-rose-50 text-rose-600',
}

const StatCard = ({ icon: Icon, label, value, sub, tone = 'brand' }) => (
  <div className="card flex items-start justify-between gap-3 p-4 sm:p-5">
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1.5 truncate text-xl font-semibold text-slate-900 sm:text-2xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
    <div className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', tones[tone])}>
      <Icon size={20} />
    </div>
  </div>
)

export default StatCard
