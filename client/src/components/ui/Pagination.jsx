import { ChevronLeft, ChevronRight } from 'lucide-react'

const Pagination = ({ page, pages, total, onChange }) => {
  if (!pages || pages <= 1) return null
  return (
    <div className="flex flex-col-reverse items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row">
      <p className="text-xs text-slate-500">
        Page {page} of {pages} · {total} total
      </p>
      <div className="flex gap-2">
        <button
          className="btn-secondary px-2.5 py-1.5"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          className="btn-secondary px-2.5 py-1.5"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

export default Pagination
