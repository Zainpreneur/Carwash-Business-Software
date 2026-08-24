import { useEffect, useState } from 'react'
import { vehiclesApi } from '../../api/resources'

const VehiclePicker = ({ customerId, value, onChange }) => {
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!customerId) {
      setVehicles([])
      return
    }
    setLoading(true)
    vehiclesApi
      .list({ customer: customerId })
      .then(setVehicles)
      .finally(() => setLoading(false))
  }, [customerId])

  if (!customerId) {
    return <p className="text-sm text-slate-400">Select a customer first</p>
  }

  if (loading) return <p className="text-sm text-slate-400">Loading vehicles…</p>

  if (vehicles.length === 0) {
    return <p className="text-sm text-amber-600">This customer has no vehicles on file yet.</p>
  }

  return (
    <select className="input" value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select a vehicle…</option>
      {vehicles.map((v) => (
        <option key={v._id} value={v._id}>
          {v.year} {v.make} {v.model} — {v.plateNumber}
        </option>
      ))}
    </select>
  )
}

export default VehiclePicker
