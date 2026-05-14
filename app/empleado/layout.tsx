'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import EmpleadoFloatNav from '@/components/empleado/EmpleadoFloatNav'

type ThemeMode = 'dark' | 'light'

export default function EmpleadoLayout({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>('dark')
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('rpm-empleado-theme')
      if (saved === 'light' || saved === 'dark') setTheme(saved)
    } catch {
      setTheme('dark')
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.empleadoTheme = theme
  }, [theme])

  return (
    <div className={theme === 'dark' ? 'rpm-dark' : 'rpm-light'}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        html, body {
          margin: 0; padding: 0;
          width: 100%;
          overflow-x: hidden;
          overscroll-behavior-y: none;
          font-family: 'Plus Jakarta Sans', sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        html[data-empleado-theme='dark']  { background: #0f0e17; }
        html[data-empleado-theme='light'] { background: #f4f1fb; }

        /* ─── DARK THEME ─── */
        .rpm-dark {
          --bg:           #0f0e17;
          --bg2:          #181622;
          --surface:      rgba(26, 24, 38, 0.92);
          --surface2:     rgba(34, 31, 50, 0.88);
          --border:       rgba(255, 255, 255, 0.06);
          --border-hover: rgba(139, 92, 246, 0.22);
          --text:         #ede9ff;
          --text-sub:     rgba(180, 170, 220, 0.55);
          --purple:       #8b5cf6;
          --purple-soft:  rgba(139, 92, 246, 0.12);
          --purple-glow:  rgba(139, 92, 246, 0.2);
          --accent:       #a78bfa;
          --green:        #34d399;
          --red:          #f87171;
          --shadow-card:  0 2px 16px rgba(0, 0, 0, 0.35), 0 1px 0 rgba(255,255,255,0.04) inset;
          --shadow-nav:   0 -1px 0 rgba(255,255,255,0.05), 0 4px 32px rgba(0,0,0,0.45);
          --nav-bg:       rgba(13, 12, 22, 0.92);
          --nav-border:   rgba(139, 92, 246, 0.15);
          --ambient-1:    rgba(99, 60, 220, 0.06);
          --ambient-2:    rgba(139, 92, 246, 0.04);
        }

        /* ─── LIGHT THEME ─── */
        .rpm-light {
          --bg:           #f4f1fb;
          --bg2:          #fdfcff;
          --surface:      rgba(255, 255, 255, 0.88);
          --surface2:     rgba(245, 242, 255, 0.92);
          --border:       rgba(139, 92, 246, 0.08);
          --border-hover: rgba(124, 58, 237, 0.18);
          --text:         #18122e;
          --text-sub:     rgba(24, 18, 46, 0.45);
          --purple:       #7c3aed;
          --purple-soft:  rgba(124, 58, 237, 0.08);
          --purple-glow:  rgba(124, 58, 237, 0.15);
          --accent:       #6d28d9;
          --green:        #059669;
          --red:          #dc2626;
          --shadow-card:  0 2px 12px rgba(100, 60, 200, 0.06), 0 1px 0 rgba(255,255,255,0.9) inset;
          --shadow-nav:   0 -1px 0 rgba(124,58,237,0.08), 0 4px 24px rgba(100,60,200,0.1);
          --nav-bg:       rgba(253, 251, 255, 0.94);
          --nav-border:   rgba(124, 58, 237, 0.12);
          --ambient-1:    rgba(124, 58, 237, 0.04);
          --ambient-2:    rgba(196, 181, 253, 0.06);
        }

        /* ─── SHELL ─── */
        .empleado-shell {
          position: relative;
          min-height: 100dvh;
          width: 100%;
          overflow: hidden;
          color: var(--text);
          background: var(--bg);
        }

        /* Ambient suave — sin orbs agresivos */
        .empleado-ambient {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }
        .empleado-ambient::before {
          content: '';
          position: absolute;
          top: -25%;
          left: -10%;
          width: 55vw;
          height: 55vw;
          border-radius: 50%;
          background: radial-gradient(circle, var(--ambient-1) 0%, transparent 70%);
        }
        .empleado-ambient::after {
          content: '';
          position: absolute;
          bottom: 10%;
          right: -12%;
          width: 40vw;
          height: 40vw;
          border-radius: 50%;
          background: radial-gradient(circle, var(--ambient-2) 0%, transparent 70%);
        }

        /* Grid de dots muy sutil */
        .empleado-grid {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background-image: radial-gradient(circle, var(--border) 1px, transparent 1px);
          background-size: 28px 28px;
          opacity: 0.4;
          mask-image: radial-gradient(ellipse 70% 60% at 50% 40%, black 20%, transparent 100%);
        }

        /* ─── SCROLL AREA ─── */
        .empleado-scroll {
          position: relative;
          z-index: 1;
          height: 100dvh;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: contain;
          scroll-behavior: smooth;
          padding-bottom: 104px;
        }

        .empleado-content {
          animation: content-fade 0.35s ease both;
        }
        @keyframes content-fade {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ─── FLOAT NAV ─── */
        .empleado-float-nav {
          position: fixed;
          bottom: 16px;
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
          grid-template-columns: repeat(5, 1fr);
          gap: 2px;
          backdrop-filter: blur(32px) saturate(160%);
          -webkit-backdrop-filter: blur(32px) saturate(160%);
          box-shadow: var(--shadow-nav);
        }

        .empleado-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          min-height: 52px;
          border-radius: 21px;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--text-sub);
          text-decoration: none;
          transition: all 0.18s ease;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }

        .empleado-nav-item svg {
          transition: transform 0.18s ease;
        }

        .empleado-nav-item:active {
          transform: scale(0.9);
        }

        .empleado-nav-item.active {
          background: var(--purple);
          color: #fff;
          box-shadow: 0 2px 12px var(--purple-glow);
        }

        .empleado-nav-item.active svg {
          transform: scale(1.08) translateY(-1px);
        }

        .empleado-nav-item:not(.active):hover {
          background: var(--purple-soft);
          color: var(--accent);
        }

        /* ─── GLASS CARD ─── */
        .glass-card {
          background: var(--surface);
          border: 1px solid var(--border);
          box-shadow: var(--shadow-card);
          backdrop-filter: blur(16px) saturate(130%);
          -webkit-backdrop-filter: blur(16px) saturate(130%);
          border-radius: 18px;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
        }
        .glass-card:hover {
          border-color: var(--border-hover);
        }

        /* Card hero morada — contenida, sin glow agresivo */
        .purple-card {
          background: linear-gradient(145deg, var(--purple) 0%, #6d28d9 100%);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 4px 24px rgba(109, 40, 217, 0.3);
          border-radius: 20px;
        }

        /* ─── STAT MINI ─── */
        .stat-mini {
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 14px;
          transition: border-color 0.2s ease;
        }
        .stat-mini:hover {
          border-color: var(--border-hover);
        }

        /* ─── FORM INPUTS ─── */
        .rpm-input {
          background: var(--surface2);
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: 11px;
          padding: 11px 15px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 16px;
          line-height: 1.2;
          -webkit-text-size-adjust: 100%;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
          outline: none;
          width: 100%;
          min-height: 44px;
          -webkit-user-select: text;
          user-select: text;
          touch-action: manipulation;
        }
        .rpm-input:focus {
          border-color: var(--purple);
          box-shadow: 0 0 0 3px var(--purple-soft);
        }
        .rpm-input::placeholder { color: var(--text-sub); }



        /* ─── MOBILE INPUT FIXES ──────────────────────────────────────────────
           Evita el zoom automático de iOS y reduce pérdida de foco/teclado.
           Nota: si un input se desmonta por keys dinámicos o componentes creados
           dentro de render, eso debe corregirse en la página específica. */
        input,
        textarea,
        select,
        button {
          font-family: 'Plus Jakarta Sans', sans-serif;
          -webkit-tap-highlight-color: transparent;
        }

        input,
        textarea,
        select {
          font-size: 16px !important;
          line-height: 1.2;
          min-height: 44px;
          max-width: 100%;
          -webkit-text-size-adjust: 100%;
          text-size-adjust: 100%;
          -webkit-user-select: text;
          user-select: text;
          touch-action: manipulation;
        }

        textarea {
          min-height: 96px;
          resize: vertical;
        }

        input:focus,
        textarea:focus,
        select:focus {
          font-size: 16px !important;
        }

        input[type='date'],
        input[type='time'],
        input[type='datetime-local'],
        input[type='month'],
        input[type='week'] {
          min-height: 44px;
          appearance: none;
          -webkit-appearance: none;
        }

        input[type='number'] {
          appearance: textfield;
          -moz-appearance: textfield;
        }

        input[type='number']::-webkit-outer-spin-button,
        input[type='number']::-webkit-inner-spin-button {
          margin: 0;
          -webkit-appearance: none;
        }

        @media (max-width: 639px) {
          input,
          textarea,
          select,
          .rpm-input {
            font-size: 16px !important;
          }
        }

        /* ─── BADGE ─── */
        .rpm-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          padding: 3px 9px;
          border-radius: 100px;
          background: var(--purple-soft);
          color: var(--accent);
          border: 1px solid var(--border-hover);
        }

        /* ─── DIVIDER ─── */
        .rpm-divider {
          border: none;
          border-top: 1px solid var(--border);
          margin: 0;
        }

        /* ─── HELPERS ─── */
        .rpm-muted  { color: var(--text-sub); }
        .rpm-label  {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-sub);
        }

        /* Scrollbar */
        .empleado-scroll::-webkit-scrollbar { width: 2px; }
        .empleado-scroll::-webkit-scrollbar-track { background: transparent; }
        .empleado-scroll::-webkit-scrollbar-thumb {
          background: var(--border-hover);
          border-radius: 2px;
        }

        /* ─── SAFE AREA iOS ─── */
        @supports (padding: env(safe-area-inset-bottom)) {
          .empleado-float-nav {
            bottom: calc(12px + env(safe-area-inset-bottom));
          }
          .empleado-scroll {
            padding-bottom: calc(104px + env(safe-area-inset-bottom));
          }
        }

        /* ─── TABLET/DESKTOP ─── */
        @media (min-width: 640px) {
          .empleado-float-nav {
            max-width: 480px;
            border-radius: 30px;
            padding: 6px;
          }
          .empleado-nav-item {
            min-height: 56px;
            font-size: 9.5px;
          }
        }
      `}</style>

      <div className="empleado-shell">
        <div className="empleado-ambient" aria-hidden="true" />
        <div className="empleado-grid" aria-hidden="true" />

        <div className="empleado-scroll">
          <div className="empleado-content mx-auto w-full max-w-[520px] px-4 pt-6 sm:max-w-[980px] sm:px-6 lg:max-w-[1180px] lg:px-8">
            {children}
          </div>
        </div>

        <EmpleadoFloatNav />
      </div>
    </div>
  )
}