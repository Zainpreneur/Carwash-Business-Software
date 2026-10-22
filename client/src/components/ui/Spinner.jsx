import { Loader2 } from 'lucide-react'

const Spinner = ({ full, size = 'md', label }) => {
  const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8', xl: 'h-12 w-12' }
  const spinner = (
    <Loader2 className={`${sizes[size]} animate-spin text-brand-600`} />
  )

  if (full) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-4 border-brand-100" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          </div>
        </div>
        {label && <p className="text-sm text-slate-500">{label}</p>}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center gap-2">
      {spinner}
      {label && <span className="text-sm text-slate-500">{label}</span>}
    </div>
  )
}

export default Spinner
