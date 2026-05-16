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
          -moz-osx-font-smoothing: grayscale;
        }

        html[data-empleado-theme='dark']  { background: #07070f; }
        html[data-empleado-theme='light'] { background: #f5f4fb; }

        /* ─── DARK THEME ─── */
        .rpm-dark {
          --bg:           #07070f;
          --bg2:          #0e0e1a;
          --surface:      #101020;
          --surface2:     #181828;
          --border:       rgba(255, 255, 255, 0.07);
          --border-hover: rgba(139, 120, 244, 0.28);
          --text:         #eeeaff;
          --text-sub:     rgba(200, 190, 240, 0.48);
          --purple:       #7c6af0;
          --purple-soft:  rgba(124, 106, 240, 0.1);
          --purple-glow:  rgba(124, 106, 240, 0.15);
          --accent:       #9b8df5;
          --green:        #34d399;
          --red:          #f87171;
          --yellow:       #fbbf24;
          --shadow-card:  0 1px 4px rgba(0, 0, 0, 0.5);
          --shadow-nav:   0 -1px 0 rgba(255, 255, 255, 0.05);
          --nav-bg:       rgba(7, 7, 15, 0.98);
          --nav-border:   rgba(255, 255, 255, 0.07);
        }

        /* ─── LIGHT THEME ─── */
        .rpm-light {
          --bg:           #f5f4fb;
          --bg2:          #ffffff;
          --surface:      #ffffff;
          --surface2:     #f0eeff;
          --border:       rgba(120, 100, 240, 0.1);
          --border-hover: rgba(100, 80, 220, 0.22);
          --text:         #1a1630;
          --text-sub:     rgba(26, 22, 48, 0.45);
          --purple:       #6d4ef0;
          --purple-soft:  rgba(109, 78, 240, 0.08);
          --purple-glow:  rgba(109, 78, 240, 0.12);
          --accent:       #5b3ee0;
          --green:        #059669;
          --red:          #dc2626;
          --yellow:       #d97706;
          --shadow-card:  0 1px 4px rgba(100, 80, 200, 0.08), 0 0 0 1px rgba(120,100,240,0.06);
          --shadow-nav:   0 -1px 0 rgba(120, 100, 240, 0.08);
          --nav-bg:       rgba(255, 255, 255, 0.98);
          --nav-border:   rgba(120, 100, 240, 0.1);
        }

        /* ─── SHELL ─── */
        .empleado-shell {
          position: relative;
          min-height: 100dvh;
          width: 100%;
          color: var(--text);
          background: var(--bg);
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
          padding-bottom: 80px;
        }

        @supports (padding: env(safe-area-inset-bottom)) {
          .empleado-scroll {
            padding-bottom: calc(72px + env(safe-area-inset-bottom));
          }
        }

        .empleado-content {
          animation: fadeUp 0.3s ease both;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ─── BOTTOM NAV ─── */
        .empleado-float-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 200;
          background: var(--nav-bg);
          border-top: 1px solid var(--nav-border);
          padding: 6px 8px;
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 2px;
          backdrop-filter: blur(20px) saturate(140%);
          -webkit-backdrop-filter: blur(20px) saturate(140%);
          box-shadow: var(--shadow-nav);
        }

        @supports (padding: env(safe-area-inset-bottom)) {
          .empleado-float-nav {
            padding-bottom: calc(6px + env(safe-area-inset-bottom));
          }
        }

        .empleado-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 8px 4px 6px;
          border-radius: 12px;
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--text-sub);
          text-decoration: none;
          transition: color 0.15s ease, background 0.15s ease;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }

        .empleado-nav-item.active {
          color: var(--accent);
          background: var(--purple-soft);
        }

        .empleado-nav-item:active {
          opacity: 0.7;
        }

        /* ─── CARD ─── */
        .glass-card {
          background: var(--surface);
          border: 1px solid var(--border);
          box-shadow: var(--shadow-card);
          border-radius: 16px;
          transition: border-color 0.2s ease;
        }
        .glass-card:hover {
          border-color: var(--border-hover);
        }

        /* ─── STAT MINI ─── */
        .stat-mini {
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 12px;
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

        /* ─── MOBILE INPUT FIXES ─── */
        input, textarea, select, button {
          font-family: 'Plus Jakarta Sans', sans-serif;
          -webkit-tap-highlight-color: transparent;
        }

        input, textarea, select {
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

        input:focus, textarea:focus, select:focus {
          font-size: 16px !important;
        }

        input[type='date'],
        input[type='time'],
        input[type='datetime-local'] {
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
          input, textarea, select, .rpm-input { font-size: 16px !important; }
        }

        /* ─── BADGE ─── */
        .rpm-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          padding: 3px 8px;
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

        /* ─── SCROLLBAR ─── */
        .empleado-scroll::-webkit-scrollbar { width: 2px; }
        .empleado-scroll::-webkit-scrollbar-track { background: transparent; }
        .empleado-scroll::-webkit-scrollbar-thumb {
          background: var(--border-hover);
          border-radius: 2px;
        }

        /* ─── TABLET/DESKTOP ─── */
        @media (min-width: 640px) {
          .empleado-float-nav {
            max-width: 540px;
            left: 50%;
            right: auto;
            transform: translateX(-50%);
            bottom: 16px;
            border-radius: 24px;
            border: 1px solid var(--nav-border);
            padding: 4px;
          }
          @supports (padding: env(safe-area-inset-bottom)) {
            .empleado-float-nav {
              bottom: 16px;
              padding-bottom: 4px;
            }
          }
          .empleado-scroll {
            padding-bottom: 96px;
          }
          @supports (padding: env(safe-area-inset-bottom)) {
            .empleado-scroll {
              padding-bottom: 96px;
            }
          }
          .empleado-nav-item {
            padding: 10px 4px 8px;
            border-radius: 18px;
          }
        }
      `}</style>

      <div className="empleado-shell">
        <div className="empleado-scroll">
          <div className="empleado-content mx-auto w-full max-w-[520px] px-4 pt-7 sm:max-w-[860px] sm:px-6 lg:max-w-[1080px] lg:px-8">
            {children}
          </div>
        </div>

        <EmpleadoFloatNav />
      </div>
    </div>
  )
}
