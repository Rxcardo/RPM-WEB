'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'
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
        *, *::before, *::after { box-sizing: border-box; }
        html, body {
          margin: 0; padding: 0;
          width: 100%;
          overflow-x: hidden;
          overscroll-behavior-y: none;
        }
        html[data-empleado-theme='dark']  { background: #1b1b21; }
        html[data-empleado-theme='light'] { background: #f7f4ff; }

        .rpm-dark {
          --bg:         #1b1b21;
          --bg2:        #25252d;
          --card:       rgba(52,52,61,.85);
          --card2:      rgba(68,67,78,.75);
          --text:       #ffffff;
          --muted:      rgba(255,255,255,.52);
          --line:       rgba(255,255,255,.10);
          --purple:     #7c5cff;
          --purple2:    #4f3a86;
          --purple3:    #a78bfa;
          --shadow:     0 24px 80px rgba(0,0,0,.38);
          --nav-bg:     rgba(28,27,36,.90);
          --nav-border: rgba(255,255,255,.10);
        }
        .rpm-light {
          --bg:         #f7f4ff;
          --bg2:        #ffffff;
          --card:       rgba(255,255,255,.92);
          --card2:      rgba(244,240,255,.96);
          --text:       #17141f;
          --muted:      rgba(23,20,31,.52);
          --line:       rgba(80,58,130,.12);
          --purple:     #7c5cff;
          --purple2:    #ede7ff;
          --purple3:    #5e3ee8;
          --shadow:     0 22px 70px rgba(93,63,211,.14);
          --nav-bg:     rgba(247,244,255,.92);
          --nav-border: rgba(124,92,255,.18);
        }

        .empleado-shell {
          position: relative;
          min-height: 100dvh;
          width: 100%;
          overflow-x: hidden;
          color: var(--text);
          background:
            radial-gradient(circle at 18% 0%,  rgba(124,92,255,.22), transparent 32%),
            radial-gradient(circle at 90% 8%,  rgba(167,139,250,.13), transparent 28%),
            linear-gradient(180deg, var(--bg), var(--bg2));
        }

        /* Scroll interno — el rubber-band no expone el fondo del browser */
        .empleado-scroll {
          height: 100dvh;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: contain;
          padding-bottom: 96px;
        }

        /* Nav flotante iOS pill */
        .empleado-float-nav {
          position: fixed;
          bottom: 18px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 100;
          width: calc(100% - 28px);
          max-width: 440px;
          background: var(--nav-bg);
          border: 1px solid var(--nav-border);
          border-radius: 30px;
          padding: 5px;
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 3px;
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
          box-shadow:
            0 10px 40px rgba(0,0,0,.26),
            0 2px 8px rgba(0,0,0,.14),
            inset 0 1px 0 rgba(255,255,255,.07);
        }
        .empleado-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          min-height: 54px;
          border-radius: 25px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .02em;
          transition: background .15s ease, color .15s ease, transform .1s ease;
          color: var(--muted);
          text-decoration: none;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }
        .empleado-nav-item:active { transform: scale(.91); }
        .empleado-nav-item.active {
          background: var(--purple);
          color: #fff;
          box-shadow: 0 4px 20px rgba(124,92,255,.42);
        }

        /* Helpers */
        .glass-card {
          background: linear-gradient(145deg, var(--card), var(--card2));
          border: 1px solid var(--line);
          box-shadow: var(--shadow);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }
        .purple-card {
          background:
            radial-gradient(circle at 85% 12%, rgba(167,139,250,.38), transparent 30%),
            linear-gradient(135deg, rgba(124,92,255,.72), rgba(60,50,81,.82));
          border: 1px solid rgba(255,255,255,.16);
          box-shadow: 0 24px 64px rgba(80,55,170,.26);
        }
        .rpm-input { background: rgba(255,255,255,.06); border: 1px solid var(--line); color: var(--text); }
        .rpm-muted { color: var(--muted); }
        .rpm-line  { border-color: var(--line); }
      `}</style>

      <div className="empleado-shell">

      

        {/* Área scrollable */}
        <div className="empleado-scroll">
          <div className="mx-auto w-full max-w-[520px] px-3 pt-16 sm:max-w-[980px] sm:px-6 lg:max-w-[1180px] lg:px-8">
            {children}
          </div>
        </div>

        {/* Nav flotante — componente externo */}
        <EmpleadoFloatNav />

      </div>
    </div>
  )
}