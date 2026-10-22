const EmptyState = ({ icon: Icon, title, message, action, compact }) => (
  <div className={`flex flex-col items-center justify-center gap-3 px-6 text-center ${compact ? 'py-8' : 'py-16'}`}>
    {Icon && (
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 text-slate-400 shadow-inner">
        <Icon size={28} strokeWidth={1.5} />
      </div>
    )}
    <div className="max-w-sm">
      <p className="font-semibold text-slate-700">{title}</p>
      {message && <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{message}</p>}
    </div>
    {action && <div className="mt-2">{action}</div>}
  </div>
)

export default EmptyState
