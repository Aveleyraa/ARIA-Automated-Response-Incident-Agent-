import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

const API = '/api'

const PRIORITY_COLORS = {
  P1: { border: 'rgba(248,81,73,0.4)', bg: 'rgba(248,81,73,0.08)', color: '#f85149' },
  P2: { border: 'rgba(251,133,0,0.4)',  bg: 'rgba(251,133,0,0.08)',  color: '#fb8500' },
  P3: { border: 'rgba(227,179,65,0.4)', bg: 'rgba(227,179,65,0.08)', color: '#e3b341' },
  P4: { border: 'rgba(63,185,80,0.4)',  bg: 'rgba(63,185,80,0.08)',  color: '#3fb950' },
}

const PRIORITY_EMOJI = { P1: '🔴', P2: '🟠', P3: '🟡', P4: '🟢' }

const FACTOR_LABELS = {
  revenue_impact:       { label: 'Revenue Impact',     weight: '30%' },
  users_affected:       { label: 'Users Affected',      weight: '25%' },
  data_integrity_risk:  { label: 'Data Integrity Risk', weight: '20%' },
  blast_radius:         { label: 'Blast Radius',        weight: '15%' },
  recoverability:       { label: 'Recoverability',      weight: '5%'  },
  time_sensitivity:     { label: 'Time Sensitivity',    weight: '5%'  },
}

export default function TicketDetail() {
  const { id } = useParams()
  const [incident, setIncident] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`${API}/incidents`)
      .then(r => r.json())
      .then(data => {
        const found = (data.incidents || []).find(
          i => i.ticket_id === id || i.incident_id === id
        )
        if (found) {
          // Merge with localStorage triage result if available
          try {
            const stored = JSON.parse(localStorage.getItem('aria_triage_results') || '{}')
            const cached = stored[found.ticket_id] || {}
            setIncident({ ...found, ...cached })
          } catch (_) {
            setIncident(found)
          }
        } else {
          setNotFound(true)
        }
      })
      .catch(() => setNotFound(true))
  }, [id])

  if (notFound) return <NotFound id={id} />
  if (!incident) return <Loading />

  const priority = incident.priority || 'P3'
  const pColors = PRIORITY_COLORS[priority] || PRIORITY_COLORS.P3
  const age = Math.floor((Date.now() / 1000 - incident.created_at) / 60)
  const ageStr = age < 60 ? `${age}m ago` : `${Math.floor(age / 60)}h ago`
  const hasScore = incident.severity_score > 0
  const hasFactors = incident.severity_factors && Object.keys(incident.severity_factors).length > 0

  return (
    <div className="animate-fade" style={{ maxWidth: 800 }}>

      {/* Back */}
      <Link to="/dashboard" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 13, color: 'var(--text2)', marginBottom: 24,
        textDecoration: 'none',
      }}>
        ← Back to Dashboard
      </Link>

      {/* Header card */}
      <div style={{
        background: 'var(--bg2)',
        border: `1px solid ${pColors.border}`,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
      }}>
        {/* Title row */}
        <div style={{ background: pColors.bg, padding: '20px 24px', borderBottom: `1px solid ${pColors.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span className={`badge badge-${priority.toLowerCase()}`}>{priority}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text2)' }}>
              {incident.ticket_id}
            </span>
            <span style={{
              marginLeft: 'auto', fontSize: 11, fontWeight: 600,
              padding: '3px 10px', borderRadius: 20,
              background: incident.status === 'resolved' ? 'rgba(63,185,80,0.15)' : 'rgba(251,133,0,0.15)',
              color: incident.status === 'resolved' ? 'var(--green)' : 'var(--orange)',
              fontFamily: 'var(--font-mono)',
            }}>
              {incident.status === 'resolved' ? '✅ Resolved' : '🔴 Open'}
            </span>
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{incident.title}</h1>
        </div>

        {/* Meta row */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          padding: '14px 24px', gap: 16,
          borderBottom: '1px solid var(--border)',
        }}>
          <Meta label="Reporter" value={incident.reporter_email} />
          <Meta label="Created" value={ageStr} />
          <Meta label="Incident ID" value={incident.incident_id} mono />
        </div>

        {/* Severity Score bar — shown if available */}
        {hasScore && (
          <SeverityScoreBar
            score={incident.severity_score}
            priority={priority}
            factors={hasFactors ? incident.severity_factors : null}
            color={pColors.color}
          />
        )}

        {/* Summary */}
        <div style={{ padding: '20px 24px' }}>
          <SectionTitle>📋 Summary</SectionTitle>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text2)', margin: 0 }}>
            {incident.summary}
          </p>
        </div>
      </div>

      {/* Root cause */}
      {incident.root_cause_hypothesis && (
        <div className="card" style={{ marginBottom: 16 }}>
          <SectionTitle>🔍 Root Cause Hypothesis</SectionTitle>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text2)', margin: '10px 0 0' }}>
            {incident.root_cause_hypothesis}
          </p>
        </div>
      )}

      {/* Affected services */}
      <div className="card" style={{ marginBottom: 16 }}>
        <SectionTitle>⚙️ Affected Services</SectionTitle>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {(incident.affected_services || []).map(s => (
            <span key={s} style={{
              background: 'var(--bg4)', border: '1px solid var(--border2)',
              borderRadius: 6, padding: '4px 12px',
              fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text)',
            }}>{s}</span>
          ))}
        </div>
      </div>

      {/* Two col: actions + pipeline */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        <div className="card">
          <SectionTitle>🛠️ Recommended Actions</SectionTitle>
          <ol style={{ paddingLeft: 18, margin: '10px 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(incident.recommended_actions || []).map((a, i) => (
              <li key={i} style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{a}</li>
            ))}
          </ol>
        </div>

        <div className="card">
          <SectionTitle>🔁 Pipeline Stages</SectionTitle>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { label: 'Ingested',       color: 'var(--accent)'  },
              { label: 'AI Triage',      color: 'var(--purple)'  },
              { label: 'Ticket Created', color: 'var(--orange)'  },
              { label: 'Team Notified',  color: 'var(--green)'   },
            ].map((s, i, arr) => (
              <div key={s.label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: s.color, marginTop: 4, flexShrink: 0,
                    boxShadow: `0 0 6px ${s.color}`,
                  }} />
                  {i < arr.length - 1 && (
                    <div style={{ width: 1, height: 24, background: 'var(--border2)' }} />
                  )}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text2)', paddingBottom: 16 }}>
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Runbook */}
      {incident.runbook_steps && incident.runbook_steps.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <SectionTitle>📋 Runbook</SectionTitle>
          <ol style={{ paddingLeft: 18, margin: '10px 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {incident.runbook_steps.map((s, i) => (
              <li key={i} style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5,
                fontFamily: 'var(--font-mono)' }}>{s}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Footer actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        <Link to="/resolve" style={{
          background: '#0d7a5f', color: 'white', fontWeight: 600,
          padding: '10px 20px', borderRadius: 8, fontSize: 13,
          textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          ✅ Resolve this ticket
        </Link>
        <Link to="/dashboard" style={{
          background: 'var(--bg3)', color: 'var(--text2)',
          border: '1px solid var(--border2)',
          padding: '10px 20px', borderRadius: 8, fontSize: 13,
          textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  )
}

// ── Severity Score Bar ────────────────────────────────────────────────────────
function SeverityScoreBar({ score, priority, factors, color }) {
  const [animated, setAnimated] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(score), 150)
    return () => clearTimeout(t)
  }, [score])

  return (
    <div style={{
      padding: '14px 24px',
      borderBottom: `1px solid ${color}22`,
      background: `${color}06`,
    }}>
      {/* Main bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: factors ? 10 : 0 }}>
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
          fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)',
          color, flexShrink: 0, minWidth: 44,
        }}>
          {score}
          <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>/100</span>
        </span>
      </div>

      {/* Factor breakdown */}
      {factors && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px 16px' }}>
          {Object.entries(FACTOR_LABELS).map(([key, meta]) => {
            const val = factors[key] ?? 0
            return (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>{meta.label}</span>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>{val}</span>
                </div>
                <div style={{ height: 3, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    width: `${val}%`, background: color, opacity: 0.7,
                    transition: 'width 1.2s ease',
                  }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 600, color: 'var(--text3)',
      textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0,
    }}>
      {children}
    </p>
  )
}

function Meta({ label, value, mono }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>{label}</p>
      <p style={{
        fontSize: 13, fontWeight: 600, margin: 0,
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        wordBreak: 'break-all',
      }}>{value}</p>
    </div>
  )
}

function Loading() {
  return (
    <div style={{ textAlign: 'center', padding: 80, color: 'var(--text3)' }}>
      <div className="animate-pulse" style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
      <p>Loading ticket...</p>
    </div>
  )
}

function NotFound({ id }) {
  return (
    <div style={{ textAlign: 'center', padding: 80 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
      <h2 style={{ fontSize: 18, marginBottom: 8 }}>Ticket not found</h2>
      <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 24 }}>
        No ticket with ID <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{id}</code>
      </p>
      <Link to="/dashboard" style={{
        background: 'var(--accent2)', color: 'white',
        padding: '10px 20px', borderRadius: 8, fontSize: 13,
        fontWeight: 600, textDecoration: 'none',
      }}>
        Go to Dashboard
      </Link>
    </div>
  )
}