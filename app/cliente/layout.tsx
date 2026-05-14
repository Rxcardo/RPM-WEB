'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import ClienteFloatNav from './_components/ClienteFloatNav'

type ThemeMode = 'dark' | 'light'

export default function ClienteLayout({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>('dark')

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('rpm-cliente-theme')
      if (saved === 'light' || saved === 'dark') setTheme(saved)
    } catch {
      setTheme('dark')
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.clienteTheme = theme
  }, [theme])

  return (
    <div className={theme === 'dark' ? 'rpm-cliente-dark' : 'rpm-cliente-light'}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          overflow-x: hidden;
          overscroll-behavior-y: none;
          font-family: 'Plus Jakarta Sans', sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .rpm-cliente-dark {
          --bg:            #0d0c14;
          --bg2:           #13111e;
          --surface:       rgba(22, 20, 34, 0.90);
          --surface2:      rgba(30, 27, 48, 0.88);
          --border:        rgba(255, 255, 255, 0.07);
          --border-strong: rgba(139, 92, 246, 0.30);
          --text:          #f0ecff;
          --muted:         rgba(210, 200, 255, 0.55);
          --muted2:        rgba(210, 200, 255, 0.32);
          --purple:        #7c3aed;
          --purple2:       #a78bfa;
          --purple-glow:   rgba(124, 58, 237, 0.18);
          --green:         #34d399;
          --green-soft:    rgba(52, 211, 153, 0.12);
          --red:           #f87171;
          --red-soft:      rgba(248, 113, 113, 0.12);
          --yellow:        #fbbf24;
          --yellow-soft:   rgba(251, 191, 36, 0.12);
          --orange:        #fb923c;
          --shadow-sm:     0 2px 12px rgba(0,0,0,0.28);
          --shadow-md:     0 8px 32px rgba(0,0,0,0.38), 0 1px 0 rgba(255,255,255,0.04) inset;
          --shadow-lg:     0 20px 60px rgba(0,0,0,0.50), 0 1px 0 rgba(255,255,255,0.06) inset;
          --nav-bg:        rgba(13, 12, 20, 0.92);
          --nav-border:    rgba(139, 92, 246, 0.20);
          --orb1:          rgba(109, 40, 217, 0.36);
          --orb2:          rgba(167, 139, 250, 0.16);
          --orb3:          rgba(236, 72, 153, 0.08);
        }

        html[data-cliente-theme='dark'] { background: #0d0c14; }

        .rpm-cliente-light {
          --bg:            #f6f4ff;
          --bg2:           #ffffff;
          --surface:       rgba(255, 255, 255, 0.88);
          --surface2:      rgba(248, 246, 255, 0.94);
          --border:        rgba(109, 40, 217, 0.10);
          --border-strong: rgba(109, 40, 217, 0.26);
          --text:          #18133a;
          --muted:         rgba(24, 19, 58, 0.55);
          --muted2:        rgba(24, 19, 58, 0.35);
          --purple:        #6d28d9;
          --purple2:       #8b5cf6;
          --purple-glow:   rgba(109, 40, 217, 0.10);
          --green:         #059669;
          --green-soft:    rgba(5, 150, 105, 0.10);
          --red:           #dc2626;
          --red-soft:      rgba(220, 38, 38, 0.09);
          --yellow:        #d97706;
          --yellow-soft:   rgba(217, 119, 6, 0.10);
          --orange:        #ea580c;
          --shadow-sm:     0 2px 8px rgba(109,40,217,0.08);
          --shadow-md:     0 8px 28px rgba(109,40,217,0.12), 0 1px 0 rgba(255,255,255,0.9) inset;
          --shadow-lg:     0 18px 48px rgba(109,40,217,0.14), 0 1px 0 rgba(255,255,255,0.9) inset;
          --nav-bg:        rgba(255, 255, 255, 0.94);
          --nav-border:    rgba(109, 40, 217, 0.14);
          --orb1:          rgba(109, 40, 217, 0.10);
          --orb2:          rgba(167, 139, 250, 0.14);
          --orb3:          rgba(236, 72, 153, 0.05);
        }

        html[data-cliente-theme='light'] { background: #f6f4ff; }

        .cliente-shell {
          position: relative;
          min-height: 100dvh;
          width: 100%;
          background: var(--bg);
          color: var(--text);
          overflow: hidden;
        }

        .cliente-orbs {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
        }

        .cliente-orb {
          position: absolute;
          border-radius: 999px;
          filter: blur(90px);
          animation: orb-drift 24s ease-in-out infinite alternate;
        }

        .cliente-orb-1 {
          width: min(80vw, 520px);
          height: min(80vw, 520px);
          top: -20%;
          right: -15%;
          background: radial-gradient(circle, var(--orb1) 0%, transparent 70%);
        }

        .cliente-orb-2 {
          width: min(70vw, 440px);
          height: min(70vw, 440px);
          bottom: -18%;
          left: -12%;
          background: radial-gradient(circle, var(--orb2) 0%, transparent 70%);
          animation-delay: -8s;
          animation-duration: 30s;
        }

        .cliente-orb-3 {
          width: min(50vw, 320px);
          height: min(50vw, 320px);
          top: 40%;
          left: 12%;
          background: radial-gradient(circle, var(--orb3) 0%, transparent 70%);
          animation-delay: -5s;
          animation-duration: 20s;
        }

        @keyframes orb-drift {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(4%, 8%) scale(1.06); }
          100% { transform: translate(-4%, -5%) scale(0.95); }
        }

        .cliente-scroll {
          position: relative;
          z-index: 1;
          height: 100dvh;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: contain;
          padding-bottom: 112px;
        }

        .cliente-content {
          width: 100%;
          max-width: 600px;
          margin: 0 auto;
          padding: 16px 16px 32px;
          animation: fade-up 0.38s ease both;
        }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── TOPBAR ── */
        .cliente-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 24px;
          padding-top: 6px;
        }

        .cliente-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        /* "RPM" wordmark grande */
        .cliente-brand-name {
          color: var(--text);
          font-size: 22px;
          font-weight: 900;
          letter-spacing: -0.05em;
          line-height: 1;
          white-space: nowrap;
        }

        .cliente-theme-btn {
          flex-shrink: 0;
          border: 1px solid var(--border);
          color: var(--muted);
          background: var(--surface);
          border-radius: 999px;
          padding: 8px 14px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          backdrop-filter: blur(24px) saturate(140%);
          -webkit-backdrop-filter: blur(24px) saturate(140%);
          transition: color .2s, border-color .2s;
        }

        .cliente-theme-btn:hover { color: var(--text); border-color: var(--border-strong); }

        /* ── SECTION ── */
        .cliente-section-label {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .cliente-section-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--purple2);
          box-shadow: 0 0 8px var(--purple2);
          flex-shrink: 0;
        }

        .cliente-section-title {
          margin: 0;
          color: var(--text);
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .cliente-section-subtitle {
          margin: 4px 0 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.5;
        }

        .cliente-page-header { margin-bottom: 20px; }

        .cliente-page-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid var(--border-strong);
          background: var(--purple-glow);
          color: var(--purple2);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          margin-bottom: 10px;
        }

        .cliente-page-title {
          margin: 0 0 6px;
          font-size: clamp(22px, 6vw, 30px);
          font-weight: 900;
          letter-spacing: -0.04em;
          color: var(--text);
          line-height: 1.1;
        }

        .cliente-page-subtitle {
          margin: 0;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.55;
        }

        /* ── CARDS ── */
        .cliente-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 20px;
          box-shadow: var(--shadow-md);
          backdrop-filter: blur(32px) saturate(160%);
          -webkit-backdrop-filter: blur(32px) saturate(160%);
          overflow: hidden;
        }

        .cliente-card-pad { padding: 16px; }

        .cliente-list { display: grid; gap: 10px; }

        .cliente-list-item {
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 14px;
          transition: border-color .2s;
        }

        .cliente-list-item:hover { border-color: var(--border-strong); }

        /* ── CHIPS ── */
        .cliente-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.04);
          color: var(--muted);
          padding: 4px 10px;
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }

        .cliente-chip-green  { border-color: rgba(52,211,153,0.24);  background: var(--green-soft);  color: var(--green);  }
        .cliente-chip-red    { border-color: rgba(248,113,113,0.22); background: var(--red-soft);   color: var(--red);   }
        .cliente-chip-yellow { border-color: rgba(251,191,36,0.22);  background: var(--yellow-soft); color: var(--yellow); }
        .cliente-chip-purple { border-color: var(--border-strong);   background: var(--purple-glow); color: var(--purple2); }

        .cliente-status-ok     { color: var(--green); }
        .cliente-status-warn   { color: var(--yellow); }
        .cliente-status-danger { color: var(--red); }

        /* ── BUTTONS ── */
        .cliente-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 40px;
          border: none;
          border-radius: 14px;
          padding: 10px 16px;
          color: white;
          background: linear-gradient(135deg, var(--purple) 0%, color-mix(in srgb, var(--purple) 60%, var(--purple2)) 100%);
          box-shadow: 0 6px 22px rgba(124,58,237,0.30);
          font-size: 12.5px;
          font-weight: 800;
          font-family: inherit;
          letter-spacing: 0.01em;
          text-decoration: none;
          cursor: pointer;
          transition: transform .14s ease, opacity .2s ease, box-shadow .2s ease;
          -webkit-tap-highlight-color: transparent;
          white-space: nowrap;
        }

        .cliente-btn:active  { transform: scale(0.95); }
        .cliente-btn:disabled { opacity: .38; cursor: not-allowed; box-shadow: none; transform: none; }

        .cliente-btn-secondary {
          background: rgba(255,255,255,0.06);
          color: var(--text);
          border: 1px solid var(--border);
          box-shadow: none;
        }

        .cliente-btn-secondary:active { transform: scale(0.95); }

        .cliente-btn-green  { background: linear-gradient(135deg, #059669, #34d399); box-shadow: 0 6px 22px rgba(52,211,153,0.28); }
        .cliente-btn-danger { background: linear-gradient(135deg, #dc2626, #f87171); box-shadow: 0 6px 22px rgba(248,113,113,0.26); }

        /* ── INPUTS ── */
        .cliente-input, .cliente-select, .cliente-textarea {
          width: 100%;
          border: 1.5px solid var(--border);
          background: rgba(255,255,255,0.04);
          color: var(--text);
          border-radius: 14px;
          padding: 12px 14px;
          outline: none;
          font: inherit;
          font-size: 14px;
          transition: border-color .2s, box-shadow .2s;
        }

        .cliente-textarea { min-height: 108px; resize: vertical; }
        .cliente-input::placeholder, .cliente-textarea::placeholder { color: var(--muted2); }

        .cliente-input:focus, .cliente-select:focus, .cliente-textarea:focus {
          border-color: var(--border-strong);
          box-shadow: 0 0 0 3px var(--purple-glow);
        }

        .cliente-label {
          display: grid;
          gap: 7px;
          color: var(--muted);
          font-size: 11.5px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .cliente-info-row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
          padding: 8px 0;
          border-bottom: 1px solid var(--border);
          font-size: 13px;
        }

        .cliente-info-row:last-child { border-bottom: none; }
        .cliente-info-key   { color: var(--muted); font-weight: 600; }
        .cliente-info-value { color: var(--text); font-weight: 700; text-align: right; }

        /* ── GRID ── */
        .cliente-grid-cards { display: grid; grid-template-columns: 1fr; gap: 10px; }

        @media (min-width: 520px) {
          .cliente-grid-cards.cols-2 { grid-template-columns: repeat(2, 1fr); }
          .cliente-grid-cards.cols-3 { grid-template-columns: repeat(2, 1fr); }
        }

        @media (min-width: 720px) {
          .cliente-grid-cards.cols-3 { grid-template-columns: repeat(3, 1fr); }
          .cliente-grid-cards.cols-4 { grid-template-columns: repeat(4, 1fr); }
        }

        /* ── FLOAT NAV ── */
        .cliente-float-nav {
          position: fixed;
          bottom: 14px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 200;
          width: calc(100% - 24px);
          max-width: 420px;
          background: var(--nav-bg);
          border: 1px solid var(--nav-border);
          border-radius: 26px;
          padding: 5px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 2px;
          backdrop-filter: blur(48px) saturate(200%);
          -webkit-backdrop-filter: blur(48px) saturate(200%);
          box-shadow: 0 10px 44px rgba(0,0,0,0.40), 0 1px 0 rgba(255,255,255,0.08) inset;
        }

        .cliente-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          min-height: 50px;
          border-radius: 21px;
          color: var(--muted);
          text-decoration: none;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          transition: all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
          -webkit-tap-highlight-color: transparent;
        }

        .cliente-nav-item:active { transform: scale(0.88); }

        .cliente-nav-item.active {
          color: white;
          background: linear-gradient(145deg, var(--purple), color-mix(in srgb, var(--purple) 65%, var(--purple2)));
          box-shadow: 0 4px 18px rgba(124,58,237,0.36), 0 1px 0 rgba(255,255,255,0.18) inset;
        }

        .cliente-divider { height: 1px; background: var(--border); margin: 14px 0; }

        .cliente-alert {
          border-radius: 14px;
          padding: 12px 14px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 10px;
        }

        .cliente-alert-info    { background: var(--purple-glow); border: 1px solid var(--border-strong);          color: var(--purple2); }
        .cliente-alert-error   { background: var(--red-soft);    border: 1px solid rgba(248,113,113,0.22);        color: var(--red);     }
        .cliente-alert-success { background: var(--green-soft);  border: 1px solid rgba(52,211,153,0.22);         color: var(--green);   }

        /* ── RESPONSIVE ── */
        @media (max-width: 380px) {
          .cliente-brand-name { font-size: 28px; }
          .cliente-theme-btn  { padding: 7px 11px; font-size: 10.5px; }
        }
      `}</style>

      <div className="cliente-shell">
        <div className="cliente-orbs" aria-hidden="true">
          <div className="cliente-orb cliente-orb-1" />
          <div className="cliente-orb cliente-orb-2" />
          <div className="cliente-orb cliente-orb-3" />
        </div>

        <div className="cliente-scroll">
          <div className="cliente-content">

            <div className="cliente-topbar">
              <div className="cliente-brand">
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  overflow: 'hidden',
                  flexShrink: 0,
                  background: '#000',
                  border: '1px solid rgba(139,92,246,0.25)',
                  boxShadow: '0 2px 10px rgba(124,58,237,0.20)',
                }}>
                  <Image
                    src="/logo-rpm.png"
                    alt="RPM"
                    width={36}
                    height={36}
                    priority
                    unoptimized
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'center',
                      display: 'block',
                    }}
                  />
                </div>
                <span className="cliente-brand-name">RPM</span>
              </div>

              <button
                type="button"
                className="cliente-theme-btn"
                onClick={() => {
                  const next = theme === 'dark' ? 'light' : 'dark'
                  setTheme(next)
                  try { window.localStorage.setItem('rpm-cliente-theme', next) } catch {}
                }}
              >
                {theme === 'dark' ? '☀ Claro' : '● Oscuro'}
              </button>
            </div>

            {children}
          </div>
        </div>

        <ClienteFloatNav />
      </div>
    </div>
  )
}