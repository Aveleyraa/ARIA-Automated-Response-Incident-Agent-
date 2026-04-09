import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const PIPELINE_STEPS = [
  { icon: '📥', label: 'Ingest',   desc: 'Multimodal report intake'   },
  { icon: '🤖', label: 'Triage',   desc: 'AI-powered root cause analysis' },
  { icon: '🎫', label: 'Ticket',   desc: 'Automated ticket creation'  },
  { icon: '📣', label: 'Notify',   desc: 'Team & reporter alerts'     },
  { icon: '✅', label: 'Resolve',  desc: 'Closed-loop resolution'     },
]

const STATS = [
  { value: '<3s',  label: 'Avg triage time'    },
  { value: 'P1→P4', label: 'Priority levels'  },
  { value: '100%', label: 'Pipeline coverage'  },
]

export default function Landing() {
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [typed, setTyped] = useState('')
  const fullText = 'Automated Response & Incident Agent'

  // Fade in on mount
  useEffect(() => {
    setTimeout(() => setVisible(true), 100)
  }, [])

  // Typewriter effect
  useEffect(() => {
    if (typed.length < fullText.length) {
      const t = setTimeout(() => setTyped(fullText.slice(0, typed.length + 1)), 45)
      return () => clearTimeout(t)
    }
  }, [typed])

  // Cycle through pipeline steps
  useEffect(() => {
    const t = setInterval(() => setActiveStep(s => (s + 1) % PIPELINE_STEPS.length), 1800)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* ── Animated grid background ── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: `
          linear-gradient(rgba(31,111,235,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(31,111,235,0.04) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
      }} />

      {/* ── Glow orbs ── */}
      <div style={{
        position: 'absolute', top: '10%', left: '15%',
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(31,111,235,0.12) 0%, transparent 70%)',
        filter: 'blur(40px)', zIndex: 0,
      }} />
      <div style={{
        position: 'absolute', bottom: '15%', right: '10%',
        width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(188,140,255,0.1) 0%, transparent 70%)',
        filter: 'blur(40px)', zIndex: 0,
      }} />

      {/* ── Main content ── */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        maxWidth: 760, width: '100%',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
      }}>

        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(31,111,235,0.1)',
          border: '1px solid rgba(31,111,235,0.25)',
          borderRadius: 20, padding: '6px 16px',
          fontSize: 12, fontFamily: 'var(--font-mono)',
          color: 'var(--accent)', marginBottom: 32,
          animation: 'fadeIn 0.5s ease 0.3s both',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--green)',
            boxShadow: '0 0 6px var(--green)',
            animation: 'pulse 2s infinite',
          }} />
          SRE AGENT · E-COMMERCE INCIDENT MANAGEMENT
        </div>

        {/* Logo + Name */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 20,
          marginBottom: 16,
          animation: 'fadeIn 0.5s ease 0.5s both',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: 'linear-gradient(135deg, #1f6feb 0%, #bc8cff 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36,
            boxShadow: '0 0 40px rgba(31,111,235,0.4)',
          }}>⚡</div>
          <div>
            <h1 style={{
              fontSize: 72, fontWeight: 800, margin: 0,
              letterSpacing: '-0.04em', lineHeight: 1,
              background: 'linear-gradient(135deg, #e6edf3 30%, #8b949e 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontFamily: 'var(--font-sans)',
            }}>ARIA</h1>
          </div>
        </div>

        {/* Typewriter subtitle */}
        <p style={{
          fontSize: 18, color: 'var(--text2)', marginBottom: 8,
          fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
          animation: 'fadeIn 0.5s ease 0.7s both',
          minHeight: 28,
        }}>
          {typed}
          <span style={{ animation: 'blink 1s infinite', color: 'var(--accent)' }}>|</span>
        </p>

        <p style={{
          fontSize: 14, color: 'var(--text3)', marginBottom: 48,
          textAlign: 'center', maxWidth: 480, lineHeight: 1.7,
          animation: 'fadeIn 0.5s ease 0.9s both',
        }}>
          Powered by <span style={{ color: 'var(--purple)' }}>Gemini AI</span> · Grounded in{' '}
          <span style={{ color: 'var(--accent)' }}>Medusa.js</span> source code ·
          End-to-end incident triage in under 3 seconds
        </p>

        {/* Pipeline stepper */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 0,
          marginBottom: 48, width: '100%', maxWidth: 640,
          animation: 'fadeIn 0.5s ease 1.1s both',
        }}>
          {PIPELINE_STEPS.map((step, i) => (
            <React.Fragment key={step.label}>
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 8,
                transition: 'all 0.4s ease',
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: activeStep === i
                    ? 'rgba(31,111,235,0.2)'
                    : activeStep > i ? 'rgba(63,185,80,0.1)' : 'var(--bg3)',
                  border: `1px solid ${activeStep === i
                    ? 'rgba(31,111,235,0.5)'
                    : activeStep > i ? 'rgba(63,185,80,0.3)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20,
                  transform: activeStep === i ? 'scale(1.1)' : 'scale(1)',
                  boxShadow: activeStep === i ? '0 0 20px rgba(31,111,235,0.3)' : 'none',
                  transition: 'all 0.4s ease',
                }}>
                  {activeStep > i ? '✓' : step.icon}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{
                    fontSize: 11, fontWeight: 700,
                    color: activeStep === i ? 'var(--accent)' : activeStep > i ? 'var(--green)' : 'var(--text3)',
                    fontFamily: 'var(--font-mono)', margin: 0,
                    transition: 'color 0.4s ease',
                  }}>{step.label}</p>
                  <p style={{
                    fontSize: 10, color: 'var(--text3)',
                    margin: 0, display: activeStep === i ? 'block' : 'none',
                  }}>{step.desc}</p>
                </div>
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <div style={{
                  height: 1, flex: 0.3,
                  background: activeStep > i
                    ? 'var(--green)'
                    : 'var(--border)',
                  transition: 'background 0.4s ease',
                  marginBottom: 28,
                }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Stats row */}
        <div style={{
          display: 'flex', gap: 1, marginBottom: 48,
          background: 'var(--border)', borderRadius: 12,
          overflow: 'hidden', width: '100%', maxWidth: 480,
          animation: 'fadeIn 0.5s ease 1.3s both',
        }}>
          {STATS.map((s, i) => (
            <div key={i} style={{
              flex: 1, padding: '16px 20px', textAlign: 'center',
              background: 'var(--bg2)',
            }}>
              <div style={{
                fontSize: 22, fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent)', marginBottom: 4,
              }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <button
          onClick={() => navigate('/submit')}
          style={{
            background: 'linear-gradient(135deg, #1f6feb, #bc8cff)',
            color: 'white', fontWeight: 700, fontSize: 16,
            padding: '16px 48px', borderRadius: 12, border: 'none',
            cursor: 'pointer', letterSpacing: '0.02em',
            boxShadow: '0 4px 24px rgba(31,111,235,0.4)',
            transition: 'all 0.2s ease',
            animation: 'fadeIn 0.5s ease 1.5s both',
            fontFamily: 'var(--font-sans)',
          }}
          onMouseEnter={e => {
            e.target.style.transform = 'translateY(-2px)'
            e.target.style.boxShadow = '0 8px 32px rgba(31,111,235,0.5)'
          }}
          onMouseLeave={e => {
            e.target.style.transform = 'translateY(0)'
            e.target.style.boxShadow = '0 4px 24px rgba(31,111,235,0.4)'
          }}
        >
          Launch ARIA →
        </button>

        <p style={{
          marginTop: 16, fontSize: 12, color: 'var(--text3)',
          fontFamily: 'var(--font-mono)',
          animation: 'fadeIn 0.5s ease 1.7s both',
        }}>
          Medusa.js · Gemini AI · FastAPI · Discord · Linear
        </p>

      </div>
    </div>
  )
}