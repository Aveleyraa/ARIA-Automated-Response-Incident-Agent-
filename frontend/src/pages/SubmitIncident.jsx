import React, { useState, useRef, useEffect, useCallback } from 'react'

const API = '/api'
const WS_BASE = window.location.protocol === 'https:' ? 'wss://' : 'ws://'

const COMPONENTS = [
  'checkout', 'payments', 'orders', 'cart', 'products',
  'search', 'auth', 'inventory', 'fulfillment', 'admin',
  'api-gateway', 'database', 'redis', 'unknown',
]

// Pipeline stages definition — order matters
const PIPELINE_STAGES = [
  {
    key: 'ingest',
    label: 'Ingesting',
    doneLabel: 'Ingested',
    icon: '📥',
    color: '#58a6ff',
    desc: 'Validating input and processing attachment',
  },
  {
    key: 'triage',
    label: 'Triaging',
    doneLabel: 'Triaged',
    icon: '🤖',
    color: '#bc8cff',
    desc: 'Gemini AI analyzing with Medusa.js codebase',
  },
  {
    key: 'ticketing',
    label: 'Creating Ticket',
    doneLabel: 'Ticket Created',
    icon: '🎫',
    color: '#e3b341',
    desc: 'Opening incident ticket',
  },
  {
    key: 'notify',
    label: 'Notifying',
    doneLabel: 'Team Notified',
    icon: '📣',
    color: '#3fb950',
    desc: 'Alerting team via email & Discord',
  },
  {
    key: 'complete',
    label: 'Completing',
    doneLabel: 'Complete',
    icon: '✅',
    color: '#39d353',
    desc: 'Pipeline finished',
  },
]

export default function SubmitIncident() {
  const [form, setForm] = useState({
    title: '', description: '', reporter_email: '',
    severity: 'medium', affected_component: 'unknown',
  })
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [logs, setLogs] = useState([])
  const [completedStages, setCompletedStages] = useState([])
  const [activeStage, setActiveStage] = useState(null)
  const wsRef = useRef(null)
  const logsEndRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // Map incoming log stage → pipeline stage key
  const resolveStage = (logStage) => {
    if (logStage === 'ingest') return 'ingest'
    if (logStage === 'triage' || logStage === 'codebase') return 'triage'
    if (logStage === 'ticketing') return 'ticketing'
    if (logStage === 'notify' || logStage === 'email' || logStage === 'discord') return 'notify'
    if (logStage === 'pipeline') return 'complete'
    return null
  }

  const connectWS = useCallback((id) => {
    const host = window.location.host
    const ws = new WebSocket(`${WS_BASE}${host}/ws/logs/${id}`)
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      setLogs(prev => [...prev, data])

      const stage = resolveStage(data.stage)
      if (stage) {
        setActiveStage(stage)
        // Mark previous stages as completed
        const idx = PIPELINE_STAGES.findIndex(s => s.key === stage)
        setCompletedStages(PIPELINE_STAGES.slice(0, idx).map(s => s.key))
        // If complete, mark all done
        if (stage === 'complete') {
          setCompletedStages(PIPELINE_STAGES.map(s => s.key))
          setActiveStage(null)
        }
      }
    }
    ws.onerror = () => {}
    wsRef.current = ws
    return ws
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    setError(null)
    setLogs([])
    setCompletedStages([])
    setActiveStage('ingest')

    const tempId = Math.random().toString(36).slice(2, 10).toUpperCase()
    const ws = connectWS(tempId)
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, v))
    if (file) fd.append('attachment', file)

    await new Promise(r => setTimeout(r, 300))

    try {
      const res = await fetch(`${API}/incidents`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Submission failed')
      setResult(data)
      setCompletedStages(PIPELINE_STAGES.map(s => s.key))
      setActiveStage(null)
      // Persist triage result so TicketDetail can read it
      try {
        const stored = JSON.parse(localStorage.getItem('aria_triage_results') || '{}')
        stored[data.ticket_id] = data
        localStorage.setItem('aria_triage_results', JSON.stringify(stored))
      } catch (_) {}
    } catch (err) {
      setError(err.message)
      setActiveStage(null)
    } finally {
      setLoading(false)
      setTimeout(() => ws.close(), 2000)
    }
  }

  const reset = () => {
    setResult(null)
    setLogs([])
    setCompletedStages([])
    setActiveStage(null)
    setError(null)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  const set = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }))

  // ── If pipeline running or done → show timeline view ──────────────────────
  if (loading || result) {
    return (
      <PipelineView
        loading={loading}
        result={result}
        logs={logs}
        completedStages={completedStages}
        activeStage={activeStage}
        logsEndRef={logsEndRef}
        onReset={reset}
      />
    )
  }

  // ── Form view ─────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Submit Incident Report</h1>
        <p style={{ color: 'var(--text2)', fontSize: 14 }}>
          Describe the issue and attach screenshots or log files. ARIA will triage automatically.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Incident Title" required>
          <input value={form.title} onChange={set('title')}
            placeholder="e.g. Checkout failing for all users" required />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Your Email" required>
            <input type="email" value={form.reporter_email} onChange={set('reporter_email')}
              placeholder="you@company.com" required />
          </Field>
          <Field label="Severity">
            <select value={form.severity} onChange={set('severity')}>
              <option value="critical">🔴 Critical – Complete outage</option>
              <option value="high">🟠 High – Major feature broken</option>
              <option value="medium">🟡 Medium – Partial degradation</option>
              <option value="low">🟢 Low – Minor / cosmetic</option>
            </select>
          </Field>
        </div>

        <Field label="Affected Component">
          <select value={form.affected_component} onChange={set('affected_component')}>
            {COMPONENTS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        <Field label="Description" required>
          <textarea value={form.description} onChange={set('description')}
            placeholder="Describe what happened, steps to reproduce, error messages..."
            rows={5} required style={{ resize: 'vertical' }} />
        </Field>

        {/* Attachment */}
        <Field label="Attachment (screenshot, log file)">
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border2)'}`,
              borderRadius: 8, padding: '24px', textAlign: 'center', cursor: 'pointer',
              background: dragOver ? 'rgba(31,111,235,0.05)' : 'var(--bg3)',
              transition: 'all 0.15s',
            }}
          >
            {file ? (
              <div>
                <div style={{ fontSize: 24, marginBottom: 4 }}>
                  {file.type.startsWith('image/') ? '🖼️' : '📄'}
                </div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{file.name}</div>
                <div style={{ color: 'var(--text2)', fontSize: 12 }}>{(file.size / 1024).toFixed(1)} KB</div>
                <button type="button"
                  onClick={e => { e.stopPropagation(); setFile(null) }}
                  style={{ marginTop: 8, fontSize: 12, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Remove
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📎</div>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                  Drop a file here or <span style={{ color: 'var(--accent)' }}>click to browse</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  PNG, JPEG, WebP, TXT, JSON, CSV · max 10 MB
                </div>
              </>
            )}
            <input ref={fileInputRef} type="file" style={{ display: 'none' }}
              accept="image/*,.txt,.log,.json,.csv"
              onChange={e => e.target.files[0] && setFile(e.target.files[0])} />
          </div>
        </Field>

        {error && (
          <div style={{
            background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)',
            borderRadius: 8, padding: '12px 16px', color: 'var(--red)', fontSize: 13,
          }}>
            ⚠️ {error}
          </div>
        )}

        <button type="submit" disabled={loading} style={{
          background: 'linear-gradient(135deg, #1f6feb, #bc8cff)',
          color: 'white', padding: '13px 24px', fontWeight: 700,
          fontSize: 15, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: '0 4px 20px rgba(31,111,235,0.3)',
          transition: 'all 0.15s',
        }}>
          ⚡ Submit & Triage with ARIA
        </button>
      </form>
    </div>
  )
}

// ── Pipeline View (timeline) ──────────────────────────────────────────────────
function PipelineView({ loading, result, logs, completedStages, activeStage, logsEndRef, onReset }) {
  const priority = result?.priority
  const pColors = {
    P1: '#f85149', P2: '#fb8500', P3: '#e3b341', P4: '#3fb950',
  }

  return (
    <div className="animate-fade" style={{ maxWidth: 760 }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            {loading ? 'ARIA is triaging…' : 'Triage Complete'}
          </h1>
          {loading && <Spinner />}
          {result && (
            <span className={`badge badge-${priority?.toLowerCase()}`}>{priority}</span>
          )}
        </div>
        {result && (
          <p style={{ color: 'var(--text2)', fontSize: 13, margin: 0 }}>
            Incident {result.incident_id} · completed in {result.elapsed_seconds}s
          </p>
        )}
      </div>

      {/* ── Animated Timeline ── */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '28px 32px', marginBottom: 24,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Background pulse for active state */}
        {loading && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 50% 0%, rgba(31,111,235,0.06) 0%, transparent 70%)',
            animation: 'pulse 2s infinite',
          }} />
        )}

        <p style={{
          fontSize: 10, fontWeight: 600, color: 'var(--text3)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          marginBottom: 24,
        }}>Pipeline Execution</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {PIPELINE_STAGES.map((stage, i) => {
            const isDone = completedStages.includes(stage.key)
            const isActive = activeStage === stage.key
            const isPending = !isDone && !isActive

            return (
              <div key={stage.key} style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

                {/* Connector line + dot */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: isDone
                      ? `${stage.color}22`
                      : isActive ? `${stage.color}18` : 'var(--bg3)',
                    border: `1.5px solid ${isDone
                      ? stage.color
                      : isActive ? stage.color : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18,
                    transform: isActive ? 'scale(1.1)' : 'scale(1)',
                    boxShadow: isActive ? `0 0 16px ${stage.color}55` : 'none',
                    transition: 'all 0.4s ease',
                    position: 'relative',
                  }}>
                    {isDone
                      ? <span style={{ fontSize: 16, color: stage.color }}>✓</span>
                      : <span style={{ opacity: isPending ? 0.4 : 1 }}>{stage.icon}</span>
                    }
                    {isActive && (
                      <div style={{
                        position: 'absolute', inset: -4, borderRadius: 16,
                        border: `1.5px solid ${stage.color}`,
                        animation: 'pulse 1.2s infinite',
                      }} />
                    )}
                  </div>
                  {i < PIPELINE_STAGES.length - 1 && (
                    <div style={{
                      width: 2, height: 28,
                      background: isDone
                        ? `linear-gradient(${stage.color}, ${PIPELINE_STAGES[i+1].color})`
                        : 'var(--border)',
                      borderRadius: 2,
                      transition: 'background 0.6s ease',
                    }} />
                  )}
                </div>

                {/* Stage info */}
                <div style={{ paddingTop: 8, paddingBottom: i < PIPELINE_STAGES.length - 1 ? 28 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 14, fontWeight: 600,
                      color: isDone ? stage.color : isActive ? 'var(--text)' : 'var(--text3)',
                      transition: 'color 0.4s ease',
                    }}>
                      {isDone ? stage.doneLabel : isActive ? stage.label : stage.doneLabel}
                    </span>
                    {isActive && (
                      <span style={{
                        fontSize: 10, fontFamily: 'var(--font-mono)',
                        color: stage.color, background: `${stage.color}18`,
                        border: `1px solid ${stage.color}44`,
                        borderRadius: 20, padding: '2px 8px',
                        animation: 'pulse 1.5s infinite',
                      }}>running</span>
                    )}
                    {isDone && (
                      <span style={{
                        fontSize: 10, fontFamily: 'var(--font-mono)',
                        color: 'var(--text3)',
                      }}>✓</span>
                    )}
                  </div>
                  <p style={{
                    fontSize: 12, color: 'var(--text3)', margin: '2px 0 0',
                    display: isActive || isDone ? 'block' : 'none',
                  }}>
                    {stage.desc}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Live Logs terminal ── */}
      {logs.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 10, overflow: 'hidden',
          }}>
            <div style={{
              background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
              padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {['#f85149', '#e3b341', '#3fb950'].map(c => (
                <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
              ))}
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text3)', marginLeft: 6 }}>
                aria · pipeline log
              </span>
              {loading && (
                <span style={{
                  marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--green)', animation: 'pulse 1.5s infinite',
                }} />
              )}
            </div>
            <div style={{
              maxHeight: 180, overflowY: 'auto',
              fontFamily: 'var(--font-mono)', fontSize: 12,
              padding: '12px 16px',
              display: 'flex', flexDirection: 'column', gap: 3,
            }}>
              {logs.map((l, i) => <LogLine key={i} log={l} />)}
              {loading && (
                <span style={{ color: 'var(--text3)' }}>
                  _<span style={{ animation: 'blink 1s infinite' }}>|</span>
                </span>
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* ── Triage Result cards ── */}
      {result && (
        <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Summary card */}
          <div style={{
            background: 'var(--bg2)', border: `1px solid ${pColors[priority] ?? 'var(--border)'}44`,
            borderRadius: 12, overflow: 'hidden',
          }}>
            <div style={{
              background: `${pColors[priority] ?? '#8b949e'}12`,
              padding: '14px 20px', borderBottom: `1px solid ${pColors[priority] ?? 'var(--border)'}33`,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span className={`badge badge-${priority?.toLowerCase()}`}>{priority}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)' }}>
                {result.ticket_id}
              </span>
              <a href={result.ticket_url} target="_blank" rel="noreferrer"
                style={{
                  marginLeft: 'auto', fontSize: 12, color: 'var(--accent)',
                  border: '1px solid var(--border2)', borderRadius: 6, padding: '4px 10px',
                  textDecoration: 'none',
                }}>
                View Ticket ↗
              </a>
            </div>

            {/* Severity Score bar */}
            {result.severity_score > 0 && (
              <SeverityScoreBar score={result.severity_score} priority={priority} factors={result.severity_factors} />
            )}

            <div style={{ padding: '16px 20px' }}>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text)', margin: 0 }}>
                {result.summary}
              </p>
            </div>
          </div>

          {/* Two col */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <ResultCard title="🔍 Root Cause">
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>
                {result.root_cause_hypothesis}
              </p>
            </ResultCard>
            <ResultCard title="⚙️ Affected Services">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.affected_services.map(s => (
                  <span key={s} style={{
                    background: 'var(--bg4)', border: '1px solid var(--border2)',
                    borderRadius: 6, padding: '3px 10px',
                    fontSize: 11, fontFamily: 'var(--font-mono)',
                  }}>{s}</span>
                ))}
              </div>
            </ResultCard>
          </div>

          <ResultCard title="🛠️ Recommended Actions">
            <ol style={{ paddingLeft: 18, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {result.recommended_actions.map((a, i) => (
                <li key={i} style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{a}</li>
              ))}
            </ol>
          </ResultCard>

          {/* Status bar */}
          <div style={{
            padding: '10px 16px',
            background: 'rgba(63,185,80,0.08)', border: '1px solid rgba(63,185,80,0.2)',
            borderRadius: 8, fontSize: 12, color: 'var(--green)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            ✅ Team notified · Reporter confirmed · Ticket created
            <button onClick={onReset} style={{
              marginLeft: 'auto', fontSize: 12, color: 'var(--text2)',
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '4px 12px', cursor: 'pointer',
            }}>
              + New Incident
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ResultCard({ title, children }) {
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '14px 18px',
    }}>
      <p style={{
        fontSize: 11, fontWeight: 600, color: 'var(--text3)',
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10,
      }}>{title}</p>
      {children}
    </div>
  )
}

function LogLine({ log }) {
  const colors = {
    ingest: 'var(--accent)', triage: 'var(--purple)', codebase: 'var(--purple)',
    ticketing: 'var(--orange)', notify: 'var(--green)',
    email: 'var(--green)', discord: 'var(--green)', pipeline: 'var(--cyan)',
  }
  const color = colors[log.stage] || 'var(--text2)'
  return (
    <div style={{ display: 'flex', gap: 10, lineHeight: 1.6 }}>
      <span style={{ color: 'var(--text3)', flexShrink: 0 }}>
        {new Date(log.ts * 1000).toISOString().slice(11, 19)}
      </span>
      <span style={{ color, flexShrink: 0, minWidth: 72 }}>[{log.stage}]</span>
      <span style={{ color: 'var(--text)' }}>{log.message}</span>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 12, fontWeight: 600,
        color: 'var(--text2)', marginBottom: 6, letterSpacing: '0.04em',
      }}>
        {label} {required && <span style={{ color: 'var(--red)' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function SeverityScoreBar({ score, priority, factors }) {
  const pColors = {
    P1: '#f85149', P2: '#fb8500', P3: '#e3b341', P4: '#3fb950',
  }
  const color = pColors[priority] || '#8b949e'
  const [animated, setAnimated] = React.useState(0)

  React.useEffect(() => {
    const t = setTimeout(() => setAnimated(score), 100)
    return () => clearTimeout(t)
  }, [score])

  const FACTOR_LABELS = {
    revenue_impact:      { label: 'Revenue Impact',      weight: '30%' },
    users_affected:      { label: 'Users Affected',       weight: '25%' },
    data_integrity_risk: { label: 'Data Integrity Risk',  weight: '20%' },
    blast_radius:        { label: 'Blast Radius',         weight: '15%' },
    recoverability:      { label: 'Recoverability',       weight: '5%'  },
    time_sensitivity:    { label: 'Time Sensitivity',     weight: '5%'  },
  }

  return (
    <div style={{
      padding: '14px 20px',
      borderBottom: `1px solid ${color}22`,
      background: `${color}06`,
    }}>
      {/* Main score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, color: 'var(--text3)',
          textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0,
        }}>
          Severity Score
        </span>
        <div style={{ flex: 1, height: 8, background: 'var(--bg4)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4,
            width: `${animated}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: `0 0 8px ${color}66`,
          }} />
        </div>
        <span style={{
          fontSize: 18, fontWeight: 800,
          fontFamily: 'var(--font-mono)',
          color, flexShrink: 0, minWidth: 44,
        }}>
          {score}
          <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>/100</span>
        </span>
      </div>

      {/* Factor breakdown */}
      {factors && Object.keys(factors).length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '6px 16px',
        }}>
          {Object.entries(FACTOR_LABELS).map(([key, meta]) => {
            const val = factors[key] ?? 0
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>{meta.label}</span>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>
                      {val}
                    </span>
                  </div>
                  <div style={{ height: 3, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      width: `${val}%`,
                      background: color,
                      opacity: 0.7,
                      transition: 'width 1.2s ease',
                    }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <span style={{
      width: 16, height: 16,
      border: '2px solid rgba(255,255,255,0.2)',
      borderTopColor: 'var(--accent)',
      borderRadius: '50%',
      display: 'inline-block',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}