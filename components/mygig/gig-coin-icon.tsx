"use client"

import { motion } from "framer-motion"

export function GigCoinIcon({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      whileHover={{ rotate: 15, scale: 1.1 }}
      transition={{ type: "spring", stiffness: 300, damping: 15 }}
    >
      <circle cx="16" cy="16" r="15" fill="url(#coinGradient)" stroke="oklch(0.7 0.14 75)" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="11" fill="none" stroke="oklch(0.7 0.14 75)" strokeWidth="0.75" opacity="0.5" />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fontSize="14"
        fontWeight="bold"
        fill="oklch(0.3 0.06 75)"
        fontFamily="sans-serif"
      >
        G
      </text>
      <defs>
        <radialGradient id="coinGradient" cx="0.35" cy="0.35" r="0.65">
          <stop offset="0%" stopColor="oklch(0.9 0.15 80)" />
          <stop offset="100%" stopColor="oklch(0.72 0.16 75)" />
        </radialGradient>
      </defs>
    </motion.svg>
  )
}
