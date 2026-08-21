import Modal from './Modal'
import { AlertTriangle } from 'lucide-react'

const ConfirmDialog = ({ open, onClose, onConfirm, title = 'Are you sure?', message, danger = true, loading }) => (
  <Modal open={open} onClose={onClose} title={title} size="sm"
    footer={
      <>
        <button className="btn-secondary" onClick={onClose} disabled={loading}>
          Cancel
        </button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={loading}>
          {loading ? 'Please wait…' : 'Confirm'}
        </button>
      </>
    }
  >
    <div className="flex gap-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${danger ? 'bg-rose-100 text-rose-600' : 'bg-brand-100 text-brand-600'}`}>
        <AlertTriangle size={18} />
      </div>
      <p className="text-sm text-slate-600">{message}</p>
    </div>
  </Modal>
)

export default ConfirmDialog
