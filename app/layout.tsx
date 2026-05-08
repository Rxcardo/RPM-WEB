import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'RPM Venezuela | Rehabilitación, Programación y Movimiento',
  description:
    'RPM Venezuela es un centro de alto rendimiento y fisioterapia ubicado en Naguanagua, estado Carabobo. Rehabilitación, programación y movimiento.',

  keywords: [
    'RPM Venezuela',
    'RPM vzla',
    'rpm.vzla',
    'rehabilitación',
    'programación y movimiento',
    'fisioterapia',
    'centro de alto rendimiento',
    'Naguanagua',
    'Carabobo',
    'fisioterapia Naguanagua',
    'rehabilitación Carabobo',
  ],

  authors: [{ name: 'RPM Venezuela' }],
  creator: 'RPM Venezuela',

  openGraph: {
    title: 'RPM Venezuela | Rehabilitación, Programación y Movimiento',
    description:
      'Centro de alto rendimiento y fisioterapia ubicado en Naguanagua, estado Carabobo.',
    siteName: 'RPM Venezuela',
    locale: 'es_VE',
    type: 'website',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'RPM Venezuela',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'RPM Venezuela',
    description:
      'Rehabilitación, programación y movimiento. Centro de alto rendimiento y fisioterapia en Naguanagua, Carabobo.',
    images: ['/og-image.jpg'],
  },

  robots: {
    index: true,
    follow: true,
  },

  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`
          ${geistSans.variable}
          ${geistMono.variable}
          min-h-screen
          bg-[#0a0b0e]
          text-white
          antialiased
          overflow-x-hidden
        `}
      >
        {children}
      </body>
    </html>
  )
}