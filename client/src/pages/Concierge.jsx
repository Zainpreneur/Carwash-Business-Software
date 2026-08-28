import { useEffect, useState, useCallback } from 'react'
import { Bot, Send, User, Wrench } from 'lucide-react'
import toast from 'react-hot-toast'
import { conciergeApi, integrationsApi } from '../api/resources'
import { getErrorMessage } from '../api/client'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'

// wash-concierge conversation viewer (not a spec'd screen — the spec's channel is WhatsApp
// itself — but site-manager visibility into what the agent said/did matters, and this app
// has no other inbox). Includes a "try it" form that exercises the exact same
// handleInboundMessage the real webhook calls, useful with or without WhatsApp connected.

const Concierge = () => {
  const [conversations, setConversations] = useState([])
  const [integrations, setIntegrations] = useState(null)
  const [loading, setLoading] = useState(true)
  const [phone, setPhone] = useState('555-0200')
  const [text, setText] = useState('Hi, where is my car?')
  const [sending, setSending] = useState(false)
  const [lastReply, setLastReply] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([conciergeApi.conversations(), integrationsApi.status()])
      .then(([convos, integ]) => {
        setConversations(convos)
        setIntegrations(integ)
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const send = async (e) => {
    e.preventDefault()
    setSending(true)
    try {
      const result = await conciergeApi.simulate(phone, text)
      setLastReply(result)
      toast.success('Concierge replied')
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  if (loading) return <Spinner full />

  // Group into threads by phone, most-recent-first
  const threads = new Map()
  for (const m of conversations) {
    if (!threads.has(m.phone)) threads.set(m.phone, [])
    threads.get(m.phone).push(m)
  }

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center gap-4 p-4">
        <span className="text-sm font-semibold text-slate-800">wash-concierge</span>
        <span className="flex items-center gap-1.5 text-sm text-slate-600">
          <Bot size={15} />
          AI agent: <Badge status={integrations?.agents?.configured ? 'active' : 'inactive'}>{integrations?.agents?.configured ? 'Connected' : 'Deterministic fallback'}</Badge>
        </span>
        <span className="flex items-center gap-1.5 text-sm text-slate-600">
          WhatsApp send: <Badge status={integrations?.whatsapp?.configured ? 'active' : 'inactive'}>{integrations?.whatsapp?.configured ? 'Connected' : 'Not connected'}</Badge>
        </span>
      </div>

      <div className="card p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Try the concierge</h3>
        <form onSubmit={send} className="flex flex-col gap-2 sm:flex-row">
          <input className="input sm:w-40" placeholder="From phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input className="input flex-1" placeholder="Message text" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn-primary shrink-0" disabled={sending} type="submit">
            <Send size={15} /> {sending ? 'Sending…' : 'Send'}
          </button>
        </form>
        {lastReply && (
          <div className="mt-3 rounded-lg bg-brand-50 p-3 text-sm text-slate-700">
            <span className="font-medium">Reply:</span> {lastReply.replyText}
            {lastReply.toolCalls?.length > 0 && (
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                <Wrench size={12} /> Tools used: {lastReply.toolCalls.map((t) => t.name).join(', ')}
              </p>
            )}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Recent conversations</h3>
        {threads.size === 0 ? (
          <div className="card"><EmptyState icon={Bot} title="No conversations yet" /></div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[...threads.entries()].map(([threadPhone, messages]) => (
              <div key={threadPhone} className="card p-4">
                <p className="mb-2 text-sm font-semibold text-slate-800">
                  {messages[0].customer?.name || 'Unknown'} <span className="font-normal text-slate-400">· {threadPhone}</span>
                </p>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {[...messages].reverse().map((m) => (
                    <div key={m._id} className={`flex gap-2 ${m.role === 'assistant' ? '' : 'justify-end'}`}>
                      {m.role === 'assistant' && <Bot size={14} className="mt-1 shrink-0 text-brand-500" />}
                      <p className={`max-w-[80%] rounded-lg px-2.5 py-1.5 text-xs ${m.role === 'assistant' ? 'bg-slate-100 text-slate-700' : 'bg-brand-600 text-white'}`}>
                        {m.content}
                      </p>
                      {m.role === 'user' && <User size={14} className="mt-1 shrink-0 text-slate-400" />}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Concierge
