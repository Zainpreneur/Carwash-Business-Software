import clsx from 'clsx'
import { Droplets, Sparkles } from 'lucide-react'
import Badge from '../ui/Badge'

const laneIcon = { 'tunnel-conveyor': Droplets, 'detail-bay': Sparkles }

const BayBoard = ({ bays }) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
    {bays.map((bay) => {
      const Icon = laneIcon[bay.bayType] || Droplets
      const occupied = !!bay.currentWashOrder
      const down = bay.operationalStatus !== 'operational'
      return (
        <div
          key={bay._id}
          className={clsx(
            'card flex flex-col gap-1.5 p-3 text-center',
            down && 'opacity-60',
            occupied && !down && 'border-brand-300 bg-brand-50/40'
          )}
        >
          <div className="flex items-center justify-center gap-1.5 text-slate-500">
            <Icon size={14} />
            <span className="text-xs font-semibold uppercase tracking-wide">Bay {bay.bayNumber}</span>
          </div>
          <p className="text-[11px] capitalize text-slate-400">{bay.bayType.replace('-', ' ')}</p>
          {down ? (
            <Badge status={bay.operationalStatus} className="mx-auto capitalize">{bay.operationalStatus}</Badge>
          ) : occupied ? (
            <>
              <p className="truncate text-sm font-medium text-slate-800">{bay.currentWashOrder.vehicle.plateNumber}</p>
              <Badge status={bay.currentWashOrder.status} className="mx-auto capitalize">
                {bay.currentWashOrder.status.replace(/-/g, ' ')}
              </Badge>
            </>
          ) : (
            <p className="py-1 text-xs text-slate-400">Open</p>
          )}
        </div>
      )
    })}
  </div>
)

export default BayBoard
