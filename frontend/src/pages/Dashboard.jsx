import React, { useState, useEffect } from 'react'

const API = '/api'

export default function Dashboard() {
  const [incidents, setIncidents] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = () => {
    Promise.all([
      fetch(`${API}/incidents`).then(r => r.json()),
      fetch(`${API}/metrics`).then(r => r.json()),
    ]).then(([inc, met]) => {
      setIncidents(inc.incidents || [])
      setMetrics(met)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 15000)
    return () => clearInterval(id)
  }, [])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Incident Dashboard</h1>
          <p style={{ color: 'var(--text2)', fontSize: 14 }}>Live view of all incidents · refreshes every 15s</p>
        </div>
        <button onClick={refresh} style={{
          background: 'var(--bg3)', border: '1px solid var(--border2)',
          color: 'var(--text)', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
        }}>↻ Refresh</button>
      </div>

      {/* Metrics bar */}
      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          <MetricCard label="Total Incidents" value={metrics.incidents_received} color="var(--accent)" />
          <MetricCard label="Resolved" value={metrics.tickets_resolved} color="var(--green)" />
          <MetricCard label="Avg Triage Time" value={`${metrics.avg_e2e_latency_seconds}s`} color="var(--purple)" />
          <MetricCard label="Guardrail Blocks" value={metrics.guardrail_blocks} color="var(--red)" />
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 60 }}>Loading incidents…</div>
      ) : incidents.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {incidents.map(inc => <IncidentRow key={inc.incident_id} inc={inc} />)}
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, color }) {
  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{label}</div>
    </div>
  )
}

function IncidentRow({ inc }) {
  const [expanded, setExpanded] = useState(false)
  const age = Math.floor((Date.now() / 1000 - inc.created_at) / 60)
  const ageStr = age < 60 ? `${age}m ago` : `${Math.floor(age / 60)}h ago`
  const pClass = `badge badge-${inc.priority?.toLowerCase()}`

  return (
    <div className="card animate-fade" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}
      onClick={() => setExpanded(!expanded)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px' }}>
        <span className={pClass}>{inc.priority}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {inc.title}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
            {inc.ticket_id} · {inc.reporter_email} · {ageStr}
          </div>
        </div>
        <StatusBadge status={inc.status} />
        <span style={{ color: 'var(--text3)', fontSize: 14, marginLeft: 8 }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div style={{ padding: '0 20px 16px', borderTop: '1px solid var(--border)', marginTop: 0 }}>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 12, lineHeight: 1.6 }}>{inc.summary}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {(inc.affected_services || []).map(s => (
              <span key={s} style={{
                background: 'var(--bg4)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '2px 9px', fontSize: 12, fontFamily: 'var(--font-mono)',
              }}>{s}</span>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <a href={inc.ticket_url} target="_blank" rel="noreferrer"
              style={{ fontSize: 12, color: 'var(--accent)' }}>
              View Ticket ↗
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    open: { color: 'var(--orange)', bg: 'rgba(251,133,0,0.1)', label: 'Open' },
    resolved: { color: 'var(--green)', bg: 'rgba(63,185,80,0.1)', label: 'Resolved' },
  }
  const s = map[status] || map.open
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
      background: s.bg, color: s.color, fontFamily: 'var(--font-mono)',
    }}>{s.label}</span>
  )
}

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: 80, color: 'var(--text3)' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text2)' }}>No incidents yet</div>
      <div style={{ fontSize: 13, marginTop: 6 }}>All systems operational</div>
    </div>
  )
}
