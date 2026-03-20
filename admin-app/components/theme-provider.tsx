'use client'

import * as React from 'react'
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from 'next-themes'

function SystemThemeSync({ enabled }: { enabled: boolean }) {
  React.useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return
    }

    const root = document.documentElement
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = (isDark: boolean) => {
      root.classList.toggle('dark', isDark)
      root.style.colorScheme = isDark ? 'dark' : 'light'
    }

    applyTheme(mediaQuery.matches)

    const onChange = (event: MediaQueryListEvent) => {
      applyTheme(event.matches)
    }

    if ('addEventListener' in mediaQuery) {
      mediaQuery.addEventListener('change', onChange)
      return () => mediaQuery.removeEventListener('change', onChange)
    }

    mediaQuery.addListener(onChange)
    return () => mediaQuery.removeListener(onChange)
  }, [enabled])

  return null
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const syncWithSystem =
    props.forcedTheme === 'system' ||
    props.defaultTheme === 'system' ||
    Boolean(props.enableSystem)

  return (
    <NextThemesProvider {...props}>
      <SystemThemeSync enabled={syncWithSystem} />
      {children}
    </NextThemesProvider>
  )
}
