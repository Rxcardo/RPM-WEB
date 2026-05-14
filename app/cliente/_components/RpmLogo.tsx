// RpmLogo.tsx
// Coloca este archivo en: app/cliente/_components/RpmLogo.tsx
// Úsalo en el layout así: <RpmLogo size={44} />

export default function RpmLogo({ size = 44 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: 'block' }}
    >
      <defs>
        <linearGradient id="rpm-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
        <linearGradient id="rpm-grad-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      {/* Hexagon background */}
      <path
        d="M50 4 L92 27 L92 73 L50 96 L8 73 L8 27 Z"
        fill="url(#rpm-grad)"
        opacity="0.15"
      />
      {/* Hexagon border */}
      <path
        d="M50 4 L92 27 L92 73 L50 96 L8 73 L8 27 Z"
        fill="none"
        stroke="url(#rpm-grad-stroke)"
        strokeWidth="2"
      />

      {/* Inner hex accent */}
      <path
        d="M50 14 L83 31.5 L83 68.5 L50 86 L17 68.5 L17 31.5 Z"
        fill="none"
        stroke="url(#rpm-grad)"
        strokeWidth="1"
        opacity="0.3"
      />

      {/* R */}
      <text
        x="18"
        y="62"
        fontFamily="'Plus Jakarta Sans', 'Arial Black', sans-serif"
        fontWeight="900"
        fontSize="38"
        letterSpacing="-3"
        fill="url(#rpm-grad)"
      >
        R
      </text>

      {/* P */}
      <text
        x="38"
        y="62"
        fontFamily="'Plus Jakarta Sans', 'Arial Black', sans-serif"
        fontWeight="900"
        fontSize="38"
        letterSpacing="-3"
        fill="#f0ecff"
        opacity="0.92"
      >
        P
      </text>

      {/* M */}
      <text
        x="59"
        y="62"
        fontFamily="'Plus Jakarta Sans', 'Arial Black', sans-serif"
        fontWeight="900"
        fontSize="38"
        letterSpacing="-3"
        fill="url(#rpm-grad)"
      >
        M
      </text>
    </svg>
  )
}