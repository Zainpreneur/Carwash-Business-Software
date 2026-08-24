import { Loader2 } from 'lucide-react'
import clsx from 'clsx'

const Spinner = ({ size = 20, className = '', full = false }) => {
  if (full) {
    return (
      <div className="flex min-h-[40vh] w-full items-center justify-center">
        <Loader2 size={size} className={clsx('animate-spin text-brand-500', className)} />
      </div>
    )
  }
  return <Loader2 size={size} className={clsx('animate-spin text-brand-500', className)} />
}

export default Spinner
