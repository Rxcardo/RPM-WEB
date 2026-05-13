'use client'

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
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

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

        html[data-cliente-theme='dark'] { background: #0b0b10; }
        html[data-cliente-theme='light'] { background: #f4f0ff; }

        .rpm-cliente-dark {
          --bg: #0b0b10;
          --bg2: #11101a;
          --surface: rgba(18, 17, 28, 0.84);
          --surface2: rgba(28, 25, 43, 0.82);
          --border: rgba(255, 255, 255, 0.08);
          --border-strong: rgba(167, 139, 250, 0.22);
          --text: #f7f4ff;
          --muted: rgba(226, 217, 255, 0.58);
          --muted2: rgba(226, 217, 255, 0.36);
          --purple: #7c3aed;
          --purple2: #a78bfa;
          --purple-soft: rgba(124, 58, 237, 0.16);
          --orange: #f97316;
          --green: #34d399;
          --red: #fb7185;
          --yellow: #fbbf24;
          --shadow-card: 0 18px 50px rgba(0,0,0,0.42), 0 1px 0 rgba(255,255,255,0.06) inset;
          --nav-bg: rgba(12, 10, 20, 0.88);
          --nav-border: rgba(167, 139, 250, 0.18);
          --orb1: rgba(109, 40, 217, 0.44);
          --orb2: rgba(167, 139, 250, 0.22);
          --orb3: rgba(249, 115, 22, 0.10);
        }

        .rpm-cliente-light {
          --bg: #f4f0ff;
          --bg2: #ffffff;
          --surface: rgba(255, 255, 255, 0.82);
          --surface2: rgba(249, 246, 255, 0.92);
          --border: rgba(124, 58, 237, 0.11);
          --border-strong: rgba(124, 58, 237, 0.22);
          --text: #1a1530;
          --muted: rgba(26, 21, 48, 0.58);
          --muted2: rgba(26, 21, 48, 0.38);
          --purple: #6d28d9;
          --purple2: #8b5cf6;
          --purple-soft: rgba(124, 58, 237, 0.10);
          --orange: #ea580c;
          --green: #059669;
          --red: #e11d48;
          --yellow: #b45309;
          --shadow-card: 0 14px 40px rgba(124,58,237,0.11), 0 1px 0 rgba(255,255,255,0.9) inset;
          --nav-bg: rgba(255, 255, 255, 0.9);
          --nav-border: rgba(124, 58, 237, 0.14);
          --orb1: rgba(124, 58, 237, 0.14);
          --orb2: rgba(167, 139, 250, 0.18);
          --orb3: rgba(249, 115, 22, 0.08);
        }

        .cliente-shell {
          position: relative;
          min-height: 100dvh;
          width: 100%;
          overflow: hidden;
          color: var(--text);
          background: var(--bg);
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
          filter: blur(78px);
          animation: cliente-orb-drift 22s ease-in-out infinite alternate;
        }

        .cliente-orb-1 {
          width: min(70vw, 540px);
          height: min(70vw, 540px);
          top: -18%;
          right: -12%;
          background: radial-gradient(circle, var(--orb1) 0%, transparent 68%);
        }

        .cliente-orb-2 {
          width: min(62vw, 460px);
          height: min(62vw, 460px);
          bottom: -15%;
          left: -10%;
          background: radial-gradient(circle, var(--orb2) 0%, transparent 68%);
          animation-delay: -7s;
          animation-duration: 27s;
        }

        .cliente-orb-3 {
          width: min(44vw, 340px);
          height: min(44vw, 340px);
          top: 34%;
          left: 9%;
          background: radial-gradient(circle, var(--orb3) 0%, transparent 68%);
          animation-delay: -4s;
          animation-duration: 19s;
        }

        @keyframes cliente-orb-drift {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(3%, 7%) scale(1.04); }
          100% { transform: translate(-3%, -4%) scale(0.96); }
        }

        .cliente-grid {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          opacity: 0.34;
          background-image: radial-gradient(circle, var(--border) 1px, transparent 1px);
          background-size: 32px 32px;
          mask-image: radial-gradient(ellipse 78% 78% at 50% 50%, black 28%, transparent 100%);
        }

        .cliente-scroll {
          position: relative;
          z-index: 1;
          height: 100dvh;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: contain;
          padding-bottom: 104px;
        }

        .cliente-content {
          width: 100%;
          max-width: 1180px;
          margin: 0 auto;
          padding: 18px 14px 28px;
          animation: cliente-content-fade 0.42s ease both;
        }

        @media (min-width: 768px) {
          .cliente-content { padding: 26px 22px 34px; }
        }

        @keyframes cliente-content-fade {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .cliente-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 18px;
        }

        .cliente-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .cliente-logo-mark {
          width: 42px;
          height: 42px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, var(--purple), var(--purple2));
          color: white;
          font-weight: 900;
          letter-spacing: -0.08em;
          box-shadow: 0 10px 30px rgba(124,58,237,0.34);
        }

        .cliente-kicker {
          margin: 0 0 3px;
          color: var(--purple2);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }

        .cliente-title {
          margin: 0;
          color: var(--text);
          font-size: clamp(20px, 5vw, 31px);
          line-height: 1.05;
          font-weight: 900;
          letter-spacing: -0.05em;
        }

        .cliente-subtitle {
          margin: 7px 0 0;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.45;
        }

        .cliente-theme-btn {
          border: 1px solid var(--border);
          color: var(--text);
          background: var(--surface);
          box-shadow: var(--shadow-card);
          border-radius: 999px;
          padding: 10px 13px;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
          backdrop-filter: blur(28px) saturate(150%);
          -webkit-backdrop-filter: blur(28px) saturate(150%);
        }

        .cliente-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 24px;
          box-shadow: var(--shadow-card);
          backdrop-filter: blur(28px) saturate(150%);
          -webkit-backdrop-filter: blur(28px) saturate(150%);
        }

        .cliente-card-pad { padding: 16px; }
        @media (min-width: 768px) { .cliente-card-pad { padding: 20px; } }

        .cliente-section-title {
          margin: 0;
          color: var(--text);
          font-size: 16px;
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .cliente-section-subtitle {
          margin: 5px 0 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.45;
        }

        .cliente-grid-cards {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        @media (min-width: 760px) {
          .cliente-grid-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }

        @media (min-width: 1040px) {
          .cliente-grid-cards.cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
          .cliente-grid-cards.cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }

        .cliente-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          border: 0;
          border-radius: 16px;
          padding: 11px 14px;
          color: white;
          background: linear-gradient(135deg, var(--purple), color-mix(in srgb, var(--purple) 68%, var(--purple2)));
          box-shadow: 0 10px 28px rgba(124,58,237,0.26);
          font-size: 13px;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
          transition: transform .15s ease, opacity .2s ease;
          -webkit-tap-highlight-color: transparent;
        }

        .cliente-btn:active { transform: scale(0.96); }
        .cliente-btn:disabled { opacity: .45; cursor: not-allowed; box-shadow: none; }

        .cliente-btn-secondary {
          background: rgba(255,255,255,0.055);
          color: var(--text);
          border: 1px solid var(--border);
          box-shadow: none;
        }

        .cliente-input, .cliente-select, .cliente-textarea {
          width: 100%;
          border: 1.5px solid var(--border);
          background: rgba(255,255,255,0.045);
          color: var(--text);
          border-radius: 16px;
          padding: 13px 14px;
          outline: none;
          font: inherit;
          font-size: 14px;
        }

        .cliente-textarea { min-height: 116px; resize: vertical; }
        .cliente-input::placeholder, .cliente-textarea::placeholder { color: var(--muted2); }

        .cliente-input:focus, .cliente-select:focus, .cliente-textarea:focus {
          border-color: var(--border-strong);
          box-shadow: 0 0 0 4px var(--purple-soft);
        }

        .cliente-label {
          display: grid;
          gap: 8px;
          color: var(--muted);
          font-size: 12px;
          font-weight: 900;
        }

        .cliente-chip {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          width: fit-content;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.052);
          color: var(--muted);
          padding: 7px 10px;
          font-size: 11px;
          font-weight: 900;
        }

        .cliente-status-ok { color: var(--green); }
        .cliente-status-warn { color: var(--yellow); }
        .cliente-status-danger { color: var(--red); }

        .cliente-list {
          display: grid;
          gap: 10px;
          margin-top: 14px;
        }

        .cliente-list-item {
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.04);
          border-radius: 18px;
          padding: 13px;
        }

        .cliente-float-nav {
          position: fixed;
          bottom: 16px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 200;
          width: calc(100% - 24px);
          max-width: 430px;
          background: var(--nav-bg);
          border: 1px solid var(--nav-border);
          border-radius: 28px;
          padding: 6px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 2px;
          backdrop-filter: blur(40px) saturate(180%);
          -webkit-backdrop-filter: blur(40px) saturate(180%);
          box-shadow: 0 8px 40px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.08);
        }

        .cliente-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          min-height: 52px;
          border-radius: 22px;
          color: var(--muted);
          text-decoration: none;
          font-size: 9.5px;
          font-weight: 900;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          -webkit-tap-highlight-color: transparent;
        }

        .cliente-nav-item:active { transform: scale(0.9); }
        .cliente-nav-item.active {
          color: white;
          background: linear-gradient(135deg, var(--purple), color-mix(in srgb, var(--purple) 70%, var(--purple2)));
          box-shadow: 0 4px 20px rgba(124,58,237,0.34), 0 1px 0 rgba(255,255,255,0.2) inset;
        }
      `}</style>

      <div className="cliente-shell">
        <div className="cliente-orbs" aria-hidden="true">
          <div className="cliente-orb cliente-orb-1" />
          <div className="cliente-orb cliente-orb-2" />
          <div className="cliente-orb cliente-orb-3" />
        </div>
        <div className="cliente-grid" aria-hidden="true" />

        <div className="cliente-scroll">
          <div className="cliente-content">
            <div className="cliente-topbar">
              <div className="cliente-brand">
                <div className="cliente-logo-mark">R</div>
                <div>
                  <p className="cliente-kicker">Portal Cliente</p>
                  <h1 className="cliente-title">RPM</h1>
                </div>
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
                {theme === 'dark' ? 'Claro' : 'Oscuro'}
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
