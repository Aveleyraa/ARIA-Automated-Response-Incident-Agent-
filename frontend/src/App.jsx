import React, { useState, useEffect } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import Landing from './pages/Landing'
import SubmitIncident from './pages/SubmitIncident'
import Dashboard from './pages/Dashboard'
import Observability from './pages/Observability'
import ResolveTicket from './pages/ResolveTicket'
import TicketDetail from './pages/TicketDetail'

const API = '/api'

export default function App() {
  const [metrics, setMetrics] = useState(null)
  const location = useLocation()
  const isLanding = location.pathname === '/'

  useEffect(() => {
    const fetchMetrics = () =>
      fetch(`${API}/metrics`).then(r => r.json()).then(setMetrics).catch(() => {})
    fetchMetrics()
    const id = setInterval(fetchMetrics, 10000)
    return () => clearInterval(id)
  }, [])

  // Landing page no tiene sidebar ni header
  if (isLanding) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
      </Routes>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header metrics={metrics} />
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar />
        <main style={{ flex: 1, padding: '32px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          <Routes>
            <Route path="/"             element={<Landing />} />
            <Route path="/submit"       element={<SubmitIncident />} />
            <Route path="/dashboard"    element={<Dashboard />} />
            <Route path="/observability"element={<Observability />} />
            <Route path="/resolve"      element={<ResolveTicket />} />
            <Route path="/tickets/:id"  element={<TicketDetail />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function Header({ metrics }) {
  return (
    <header style={{
      background: 'var(--bg2)',
      borderBottom: '1px solid var(--border)',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 56,
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'linear-gradient(135deg, #1f6feb, #bc8cff)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
        }}>⚡</div>
        <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em' }}>ARIA</span>
        <span style={{
          fontSize: 11, fontFamily: 'var(--font-mono)',
          color: 'var(--text3)', background: 'var(--bg3)',
          border: '1px solid var(--border)', borderRadius: 4,
          padding: '2px 6px',
        }}>e-commerce · SRE</span>
      </div>
      {metrics && (
        <div style={{ display: 'flex', gap: 24, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>
          <span>incidents <strong style={{ color: 'var(--accent)' }}>{metrics.incidents_received}</strong></span>
          <span>resolved <strong style={{ color: 'var(--green)' }}>{metrics.tickets_resolved}</strong></span>
          <span>blocked <strong style={{ color: 'var(--red)' }}>{metrics.guardrail_blocks}</strong></span>
          <StatusDot />
        </div>
      )}
    </header>
  )
}

function StatusDot() {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: 'var(--green)',
        boxShadow: '0 0 6px var(--green)',
        animation: 'pulse 2s infinite',
      }} />
      <span style={{ color: 'var(--green)' }}>live</span>
    </span>
  )
}

function Sidebar() {
  const links = [
    { to: '/submit',        label: 'Submit Incident', icon: '⚠️' },
    { to: '/dashboard',     label: 'Dashboard',       icon: '📊' },
    { to: '/observability', label: 'Observability',   icon: '🔭' },
    { to: '/resolve',       label: 'Resolve Ticket',  icon: '✅' },
  ]
  return (
    <nav style={{
      width: 220,
      background: 'var(--bg2)',
      borderRight: '1px solid var(--border)',
      padding: '24px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      flexShrink: 0,
    }}>
      <p style={{
        fontSize: 10, fontWeight: 600, color: 'var(--text3)',
        letterSpacing: '0.1em', textTransform: 'uppercase',
        padding: '0 8px', marginBottom: 8,
      }}>Navigation</p>
      {links.map(l => (
        <NavLink key={l.to} to={l.to} style={({ isActive }) => ({
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 12px', borderRadius: 8, fontSize: 14, fontWeight: 500,
          color: isActive ? 'var(--text)' : 'var(--text2)',
          background: isActive ? 'var(--bg4)' : 'transparent',
          border: isActive ? '1px solid var(--border2)' : '1px solid transparent',
          textDecoration: 'none',
          transition: 'all 0.12s',
        })}>
          <span style={{ fontSize: 16 }}>{l.icon}</span>
          {l.label}
        </NavLink>
      ))}
      <div style={{ marginTop: 'auto', padding: '12px 8px', borderTop: '1px solid var(--border)' }}>
        <p style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)', lineHeight: 1.7 }}>
          powered by<br />
          <span style={{ color: 'var(--purple)' }}>Gemini AI</span><br />
          <span style={{ color: 'var(--accent)' }}>Medusa.js</span> codebase
        </p>
      </div>
    </nav>
  )
}