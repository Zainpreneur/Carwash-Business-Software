import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { Plus, BookOpen, History, Trash2, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { knowledgeBaseApi } from '../api/resources'
import { getErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'

// Knowledge Base (06-platform/knowledge-base.md) — authored articles that ground
// wash-concierge's FAQ answers (see search_knowledge_base in server/src/agents/washConcierge.js)
// instead of the model improvising policy. Only the 'knowledge-article' and 'customer-facing'
// categories are ever searched by that tool; 'internal' articles (SOPs, safety procedures) are
// for staff reference only. Not built: the spec's google-business-profile sync and
// generic-custom-webhook-backed wiki source, e-signature on membership-agreement, and
// deterministic-render generation of wash-receipt/membership-agreement/wash-package-comparison
// (those three are "generated from" live records per the spec, not authored here) — this page
// covers the authored-content half only.
const CATEGORY_LABEL = {
  'knowledge-article': 'FAQ / Knowledge Article',
  'customer-facing': 'Customer-Facing Policy',
  internal: 'Internal (Staff Only)',
}
const CATEGORIES = ['knowledge-article', 'customer-facing', 'internal']

const emptyForm = { category: 'knowledge-article', title: '', body: '' }

const KnowledgeBase = () => {
  const { user } = useAuth()
  const canEdit = user?.role === 'admin' || user?.role === 'manager'

  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [historyFor, setHistoryFor] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    knowledgeBaseApi
      .list()
      .then(setArticles)
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (article) => {
    setEditing(article)
    setForm({ category: article.category, title: article.title, body: article.body })
    setModalOpen(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        await knowledgeBaseApi.update(editing._id, form)
        toast.success('Article updated — prior version kept in history')
      } else {
        await knowledgeBaseApi.create(form)
        toast.success('Article published')
      }
      setModalOpen(false)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (article) => {
    if (!window.confirm(`Delete "${article.title}"? This cannot be undone.`)) return
    try {
      await knowledgeBaseApi.remove(article._id)
      toast.success('Article deleted')
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  if (loading) return <Spinner full />

  const filtered = filter === 'all' ? articles : articles.filter((a) => a.category === filter)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setFilter('all')} className={`rounded-full px-3 py-1 text-xs font-medium ${filter === 'all' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>All</button>
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setFilter(c)} className={`rounded-full px-3 py-1 text-xs font-medium ${filter === c ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>{CATEGORY_LABEL[c]}</button>
          ))}
        </div>
        {canEdit && <button className="btn-primary" onClick={openCreate}><Plus size={16} /> New article</button>}
      </div>

      <p className="text-xs text-slate-400">
        wash-concierge cites knowledge-article and customer-facing articles verbatim when answering policy questions over WhatsApp — edit here and it takes effect on the next customer message, no redeploy needed. Internal articles are staff reference only and are never shown to that tool.
      </p>

      {filtered.length === 0 ? (
        <div className="card"><EmptyState icon={BookOpen} title="No articles in this category yet" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <div key={a._id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-slate-800">{a.title}</h3>
                    <Badge status={a.category}>{CATEGORY_LABEL[a.category]}</Badge>
                    {a.version > 1 && <span className="text-xs text-slate-400">v{a.version}</span>}
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-600">{a.body}</p>
                  <p className="mt-2 text-xs text-slate-400">Updated {format(new Date(a.updatedAt), 'MMM d, yyyy')}</p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-1.5">
                    {a.previousVersions?.length > 0 && (
                      <button className="btn-secondary p-1.5" title="Version history" onClick={() => setHistoryFor(a)}><History size={14} /></button>
                    )}
                    <button className="btn-secondary p-1.5" title="Edit" onClick={() => openEdit(a)}><Pencil size={14} /></button>
                    <button className="btn-secondary p-1.5 text-red-500" title="Delete" onClick={() => remove(a)}><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit article' : 'New article'}>
        <form id="kb-form" onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
          </div>
          <div><label className="label">Title</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
          <div><label className="label">Body</label><textarea className="input" rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required /></div>
          {editing && <p className="text-xs text-slate-400">Saving bumps this to v{editing.version + 1} and keeps the current version in history.</p>}
        </form>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
          <button type="submit" form="kb-form" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Publish'}</button>
        </div>
      </Modal>

      <Modal open={!!historyFor} onClose={() => setHistoryFor(null)} title={historyFor ? `Version history — ${historyFor.title}` : ''} size="lg">
        {historyFor && (
          <div className="max-h-96 space-y-3 overflow-y-auto">
            {[...historyFor.previousVersions].reverse().map((v) => (
              <div key={v.version} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>v{v.version}</span>
                  <span>{format(new Date(v.updatedAt), 'MMM d, yyyy')}</span>
                </div>
                <p className="mt-1 font-medium text-slate-700">{v.title}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{v.body}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default KnowledgeBase
