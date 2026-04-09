import React, { useState, useEffect } from 'react'

const API = '/api'

export default function ResolveTicket() {
  const [incidents, setIncidents] = useState([])
  const [form, setForm] = useState({ ticket_id: '', reporter_email: '', resolution_summary: '', resolved_by: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${API}/incidents`).then(r => r.json()).then(d => setIncidents(d.incidents || []))
  }, [])

  const selectIncident = (inc) => {
    setForm(f => ({ ...f, ticket_id: inc.ticket_id, reporter_email: inc.reporter_email }))
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`${API}/webhooks/ticket-resolved`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to resolve')
      setSuccess(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const openIncidents = incidents.filter(i => i.status === 'open')

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Resolve Ticket</h1>
        <p style={{ color: 'var(--text2)', fontSize: 14 }}>
          Mark an incident as resolved. The reporter will receive an automated email notification.
        </p>
      </div>

      {/* Quick-select open incidents */}
      {openIncidents.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Open Incidents – click to pre-fill
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {openIncidents.slice(0, 5).map(inc => (
              <button key={inc.incident_id} onClick={() => selectIncident(inc)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: form.ticket_id === inc.ticket_id ? 'var(--bg4)' : 'var(--bg2)',
                  border: `1px solid ${form.ticket_id === inc.ticket_id ? 'var(--accent2)' : 'var(--border)'}`,
                  borderRadius: 8, padding: '10px 14px', textAlign: 'left', cursor: 'pointer',
                  color: 'var(--text)',
                }}>
                <span className={`badge badge-${inc.priority?.toLowerCase()}`}>{inc.priority}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{inc.ticket_id}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{inc.reporter_email}</div>
                </div>
                <div style={{ flex: 1, fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {inc.title}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Ticket ID" required>
            <input value={form.ticket_id} onChange={set('ticket_id')} placeholder="MOCK-AB1234" required />
          </Field>
          <Field label="Reporter Email" required>
            <input type="email" value={form.reporter_email} onChange={set('reporter_email')} placeholder="reporter@company.com" required />
          </Field>
        </div>

        <Field label="Resolved By" required>
          <input value={form.resolved_by} onChange={set('resolved_by')} placeholder="e.g. Jane Smith / Platform Team" required />
        </Field>

        <Field label="Resolution Summary" required>
          <textarea
            value={form.resolution_summary}
            onChange={set('resolution_summary')}
            placeholder="Describe what was fixed and how (e.g. rolled back deploy abc123, re-indexed MeiliSearch, applied hotfix #456)…"
            rows={4}
            required
            style={{ resize: 'vertical' }}
          />
        </Field>

        {error && (
          <div style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: 8, padding: '10px 14px', color: 'var(--red)', fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div className="animate-fade" style={{ background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.3)', borderRadius: 8, padding: '14px 18px', color: 'var(--green)', fontSize: 13 }}>
            ✅ Ticket resolved. Reporter notification sent.
          </div>
        )}

        <button type="submit" disabled={loading} style={{
          background: loading ? 'var(--bg4)' : '#0d7a5f',
          color: 'white', fontWeight: 600, fontSize: 15,
          padding: '12px 24px', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          opacity: loading ? 0.7 : 1,
        }}>
          {loading ? 'Resolving…' : '✅ Mark as Resolved & Notify Reporter'}
        </button>
      </form>

      <div className="card" style={{ marginTop: 20, padding: '14px 18px', background: 'rgba(88,166,255,0.06)' }}>
        <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 }}>
          <strong>Note:</strong> This triggers the <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>POST /webhooks/ticket-resolved</code> endpoint.
          In production, your ticketing system (Linear, Jira, etc.) would call this automatically via webhook when a ticket status changes.
        </p>
      </div>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6, letterSpacing: '0.04em' }}>
        {label} {required && <span style={{ color: 'var(--red)' }}>*</span>}
      </label>
      {children}
    </div>
  )
}
