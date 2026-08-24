import { Link } from 'react-router-dom'
import { Droplets } from 'lucide-react'

const NotFound = () => (
  <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
      <Droplets size={26} />
    </div>
    <h1 className="text-3xl font-bold text-slate-900">404</h1>
    <p className="text-slate-500">The page you're looking for doesn't exist.</p>
    <Link to="/" className="btn-primary mt-2">Back to dashboard</Link>
  </div>
)

export default NotFound
