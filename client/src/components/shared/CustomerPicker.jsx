import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { customersApi } from '../../api/resources'

const CustomerPicker = ({ value, onChange, placeholder = 'Search customer by name or phone…' }) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    if (!query) {
      setResults([])
      return
    }
    const t = setTimeout(() => {
      customersApi.list({ search: query, limit: 6 }).then((res) => setResults(res.data))
    }, 200)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
        <div>
          <p className="font-medium text-slate-800">{value.name}</p>
          <p className="text-xs text-slate-500">{value.phone}</p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="rounded p-1 text-slate-400 hover:bg-slate-200">
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-9"
          placeholder={placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {results.map((c) => (
            <button
              type="button"
              key={c._id}
              onClick={() => {
                onChange(c)
                setOpen(false)
                setQuery('')
              }}
              className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span className="font-medium text-slate-800">{c.name}</span>
              <span className="text-xs text-slate-500">{c.phone}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default CustomerPicker
