import React, { useState, useEffect, useRef } from 'react'

const API = '/api'

const STAGE_COLORS = {
  ingest: '#58a6ff',
  triage: '#bc8cff',
  ticketing: '#e3b341',
  notify: '#3fb950',
  webhook: '#39d353',
  email: '#79c0ff',
  guardrail: '#f85149',
  pipeline: '#ffa657',
  system: '#8b949e',
}

export default function Observability() {
  const [logs, setLogs] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [filter, setFilter] = useState('all')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const bottomRef = useRef(null)

  const refresh = () => {
    fetch(`${API}/logs?limit=200`).then(r => r.json()).then(d => setLogs(d.logs || []))
    fetch(`${API}/metrics`).then(r => r.json()).then(setMetrics)
  }

  useEffect(() => {
    refresh()
    if (!autoRefresh) return
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [autoRefresh])

  const stages = ['all', ...new Set(logs.map(l => l.stage))]
  const filtered = filter === 'all' ? logs : logs.filter(l => l.stage === filter)

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Observability</h1>
        <p style={{ color: 'var(--text2)', fontSize: 14 }}>Structured event logs covering all pipeline stages</p>
      </div>

      {/* Metrics grid */}
      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
          {[
            { k: 'incidents_received', label: 'Received', color: 'var(--accent)' },
            { k: 'triages_completed', label: 'Triaged', color: 'var(--purple)' },
            { k: 'tickets_created', label: 'Tickets', color: 'var(--orange)' },
            { k: 'notifications_sent', label: 'Notifications', color: 'var(--green)' },
            { k: 'triage_errors', label: 'Triage Errors', color: 'var(--red)' },
            { k: 'guardrail_blocks', label: 'Blocked', color: 'var(--red)' },
            { k: 'avg_e2e_latency_seconds', label: 'Avg Latency (s)', color: 'var(--yellow)' },
            { k: 'uptime_seconds', label: 'Uptime (s)', color: 'var(--text2)' },
          ].map(m => (
            <div key={m.k} className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: m.color, fontFamily: 'var(--font-mono)' }}>
                {metrics[m.k] ?? '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{m.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Pipeline Stage Summary */}
      <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          Pipeline Stage Activity
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(STAGE_COLORS).map(([stage, color]) => {
            const count = logs.filter(l => l.stage === stage).length
            if (count === 0) return null
            return (
              <button key={stage} onClick={() => setFilter(filter === stage ? 'all' : stage)}
                style={{
                  background: filter === stage ? `${color}22` : 'var(--bg3)',
                  border: `1px solid ${filter === stage ? color : 'var(--border)'}`,
                  borderRadius: 20, padding: '4px 12px', fontSize: 12,
                  color: filter === stage ? color : 'var(--text2)',
                  fontFamily: 'var(--font-mono)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
                {stage}
                <span style={{ color: 'var(--text3)' }}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <p style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
          {filtered.length} events {filter !== 'all' && `· stage: ${filter}`}
        </p>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => setAutoRefresh(!autoRefresh)} style={{
            background: autoRefresh ? 'rgba(63,185,80,0.1)' : 'var(--bg3)',
            border: `1px solid ${autoRefresh ? 'rgba(63,185,80,0.3)' : 'var(--border)'}`,
            color: autoRefresh ? 'var(--green)' : 'var(--text2)',
            borderRadius: 6, padding: '6px 12px', fontSize: 12,
          }}>
            {autoRefresh ? '⏸ Auto' : '▶ Auto'}
          </button>
          <button onClick={refresh} style={{
            background: 'var(--bg3)', border: '1px solid var(--border2)',
            color: 'var(--text)', borderRadius: 6, padding: '6px 12px', fontSize: 12,
          }}>↻ Refresh</button>
          <button onClick={() => setFilter('all')} style={{
            background: 'var(--bg3)', border: '1px solid var(--border)',
            color: 'var(--text2)', borderRadius: 6, padding: '6px 12px', fontSize: 12,
          }}>Clear Filter</button>
        </div>
      </div>

      {/* Log terminal */}
      <div style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        overflow: 'hidden',
      }}>
        <div style={{
          background: 'var(--bg2)',
          borderBottom: '1px solid var(--border)',
          padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {['#f85149', '#e3b341', '#3fb950'].map(c => (
            <span key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c, display: 'inline-block' }} />
          ))}
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text3)', marginLeft: 8 }}>
            sre-agent · event log
          </span>
          {autoRefresh && <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 2s infinite' }} />}
        </div>
        <div style={{ maxHeight: 500, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {filtered.length === 0 && (
            <span style={{ color: 'var(--text3)' }}>No events yet. Submit an incident to see the pipeline in action.</span>
          )}
          {filtered.map((log, i) => <LogEntry key={i} log={log} />)}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}

function LogEntry({ log }) {
  const color = STAGE_COLORS[log.stage] || 'var(--text2)'
  const ts = new Date(log.ts * 1000).toISOString().replace('T', ' ').slice(0, 23)
  const dataStr = Object.keys(log.data || {}).length > 0
    ? ' ' + JSON.stringify(log.data)
    : ''

  return (
    <div style={{ display: 'flex', gap: 10, lineHeight: 1.6 }}>
      <span style={{ color: 'var(--text3)', flexShrink: 0, fontSize: 11 }}>{ts}</span>
      <span style={{ color, flexShrink: 0, minWidth: 72 }}>[{log.stage}]</span>
      <span style={{ color: 'var(--text2)' }}>{log.event}</span>
      {dataStr && <span style={{ color: 'var(--text3)', wordBreak: 'break-all' }}>{dataStr}</span>}
    </div>
  )
}
