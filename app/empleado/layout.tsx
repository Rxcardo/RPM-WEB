'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import EmpleadoFloatNav from '@/components/empleado/EmpleadoFloatNav'

type ThemeMode = 'dark' | 'light'

export default function EmpleadoLayout({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('rpm-empleado-theme')
      if (saved === 'light' || saved === 'dark') setTheme(saved)
    } catch {
      setTheme('dark')
    }
    setMounted(true)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.empleadoTheme = theme
  }, [theme])

  return (
    <div className={theme === 'dark' ? 'rpm-dark' : 'rpm-light'}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

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
        html[data-empleado-theme='light'] { background: #f2eeff; }

        /* ─── DARK THEME ─── */
        .rpm-dark {
          --bg:           #0f0e17;
          --bg2:          #1a1826;
          --surface:      rgba(30, 28, 44, 0.9);
          --surface2:     rgba(40, 37, 58, 0.85);
          --border:       rgba(255, 255, 255, 0.07);
          --border-glow:  rgba(124, 92, 255, 0.25);
          --text:         #f0eeff;
          --text-sub:     rgba(200, 192, 240, 0.6);
          --purple:       #8b5cf6;
          --purple-soft:  rgba(139, 92, 246, 0.18);
          --purple-glow:  rgba(139, 92, 246, 0.35);
          --accent:       #c4b5fd;
          --green:        #34d399;
          --shadow-card:  0 8px 32px rgba(0, 0, 0, 0.4), 0 1px 0 rgba(255,255,255,0.05) inset;
          --shadow-nav:   0 -1px 0 rgba(255,255,255,0.06), 0 8px 40px rgba(0,0,0,0.5);
          --nav-bg:       rgba(15, 13, 25, 0.88);
          --nav-border:   rgba(139, 92, 246, 0.2);
          --orb1:         rgba(139, 92, 246, 0.15);
          --orb2:         rgba(196, 181, 253, 0.07);
          --orb3:         rgba(52, 211, 153, 0.05);
        }

        /* ─── LIGHT THEME ─── */
        .rpm-light {
          --bg:           #f2eeff;
          --bg2:          #faf8ff;
          --surface:      rgba(255, 255, 255, 0.85);
          --surface2:     rgba(243, 238, 255, 0.9);
          --border:       rgba(139, 92, 246, 0.1);
          --border-glow:  rgba(139, 92, 246, 0.2);
          --text:         #1a1530;
          --text-sub:     rgba(26, 21, 48, 0.5);
          --purple:       #7c3aed;
          --purple-soft:  rgba(124, 58, 237, 0.1);
          --purple-glow:  rgba(124, 58, 237, 0.2);
          --accent:       #6d28d9;
          --green:        #059669;
          --shadow-card:  0 4px 24px rgba(124, 58, 237, 0.08), 0 1px 0 rgba(255,255,255,0.8) inset;
          --shadow-nav:   0 -1px 0 rgba(124,58,237,0.1), 0 8px 40px rgba(124,58,237,0.12);
          --nav-bg:       rgba(252, 250, 255, 0.92);
          --nav-border:   rgba(124, 58, 237, 0.15);
          --orb1:         rgba(139, 92, 246, 0.1);
          --orb2:         rgba(196, 181, 253, 0.12);
          --orb3:         rgba(52, 211, 153, 0.06);
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

        /* Orbs de fondo */
        .empleado-orbs {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
        }
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          animation: orb-drift 20s ease-in-out infinite alternate;
        }
        .orb-1 {
          width: 60vw; height: 60vw;
          top: -20%; left: -15%;
          background: var(--orb1);
          animation-duration: 22s;
        }
        .orb-2 {
          width: 45vw; height: 45vw;
          top: 10%; right: -10%;
          background: var(--orb2);
          animation-duration: 28s;
          animation-delay: -8s;
        }
        .orb-3 {
          width: 35vw; height: 35vw;
          bottom: 15%; left: 20%;
          background: var(--orb3);
          animation-duration: 18s;
          animation-delay: -4s;
        }
        @keyframes orb-drift {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(4%, 6%) scale(1.06); }
          100% { transform: translate(-3%, -4%) scale(0.96); }
        }

        /* Grid de dots sutil */
        .empleado-grid {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background-image:
            radial-gradient(circle, var(--border) 1px, transparent 1px);
          background-size: 32px 32px;
          opacity: 0.5;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%);
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

        /* Fade-in del contenido */
        .empleado-content {
          animation: content-fade 0.4s ease both;
        }
        @keyframes content-fade {
          from { opacity: 0; transform: translateY(10px); }
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
          border-radius: 28px;
          padding: 6px;
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 2px;
          backdrop-filter: blur(40px) saturate(180%);
          -webkit-backdrop-filter: blur(40px) saturate(180%);
          box-shadow:
            var(--shadow-nav),
            inset 0 1px 0 rgba(255,255,255,0.08);
        }

        .empleado-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          min-height: 52px;
          border-radius: 22px;
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: var(--text-sub);
          text-decoration: none;
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          -webkit-tap-highlight-color: transparent;
          user-select: none;
          position: relative;
          overflow: hidden;
        }

        .empleado-nav-item svg {
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .empleado-nav-item:active {
          transform: scale(0.88);
        }

        .empleado-nav-item.active {
          background: linear-gradient(135deg, var(--purple), color-mix(in srgb, var(--purple) 70%, var(--accent)));
          color: #fff;
          box-shadow:
            0 4px 20px var(--purple-glow),
            0 1px 0 rgba(255,255,255,0.2) inset;
        }

        .empleado-nav-item.active svg {
          transform: scale(1.1) translateY(-1px);
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
          backdrop-filter: blur(20px) saturate(140%);
          -webkit-backdrop-filter: blur(20px) saturate(140%);
          border-radius: 20px;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .glass-card:hover {
          border-color: var(--border-glow);
          box-shadow: var(--shadow-card), 0 0 0 1px var(--border-glow);
        }

        /* Card accent morado */
        .purple-card {
          background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--purple) 85%, transparent),
            color-mix(in srgb, var(--accent) 70%, transparent)
          );
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 12px 48px var(--purple-glow);
          border-radius: 20px;
        }

        /* ─── FORM INPUTS ─── */
        .rpm-input {
          background: var(--surface2);
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: 12px;
          padding: 12px 16px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 15px;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
          outline: none;
          width: 100%;
        }
        .rpm-input:focus {
          border-color: var(--purple);
          box-shadow: 0 0 0 3px var(--purple-soft);
        }
        .rpm-input::placeholder { color: var(--text-sub); }

        /* ─── BADGE ─── */
        .rpm-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 100px;
          background: var(--purple-soft);
          color: var(--accent);
          border: 1px solid var(--border-glow);
        }

        /* ─── HELPERS ─── */
        .rpm-muted  { color: var(--text-sub); }
        .rpm-line   { border-color: var(--border); }

        /* Scrollbar personalizado */
        .empleado-scroll::-webkit-scrollbar { width: 3px; }
        .empleado-scroll::-webkit-scrollbar-track { background: transparent; }
        .empleado-scroll::-webkit-scrollbar-thumb {
          background: var(--border-glow);
          border-radius: 3px;
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
            border-radius: 32px;
            padding: 7px;
          }
          .empleado-nav-item {
            min-height: 58px;
            font-size: 10px;
          }
        }
      `}</style>

      <div className="empleado-shell">
        {/* Orbs animados */}
        <div className="empleado-orbs" aria-hidden="true">
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
        </div>

        {/* Grid de dots */}
        <div className="empleado-grid" aria-hidden="true" />

        {/* Área scrollable */}
        <div className="empleado-scroll">
          <div className="empleado-content mx-auto w-full max-w-[520px] px-4 pt-6 sm:max-w-[980px] sm:px-6 lg:max-w-[1180px] lg:px-8">
            {children}
          </div>
        </div>

        {/* Nav flotante */}
        <EmpleadoFloatNav />
      </div>
    </div>
  )
}