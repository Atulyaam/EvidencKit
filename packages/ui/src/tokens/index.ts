/**
 * EvidenceKit Unified Design Tokens
 * Centralized token system shared across TraceVault and AgentLedger.
 * Provides accessible semantic colors, light/dark theme definitions,
 * typography scales, spacing, radii, shadows, and responsive breakpoints.
 */

export const colors = {
  // Brand Palettes
  brand: {
    tracevault: {
      50: "#eff6ff",
      100: "#dbeafe",
      200: "#bfdbfe",
      300: "#93c5fd",
      400: "#60a5fa",
      500: "#3b82f6",
      600: "#2563eb",
      700: "#1d4ed8",
      800: "#1e40af",
      900: "#1e3a8a",
      950: "#172554"
    },
    agentledger: {
      50: "#faf5ff",
      100: "#f3e8ff",
      200: "#e9d5ff",
      300: "#d8b4fe",
      400: "#c084fc",
      500: "#a855f7",
      600: "#9333ea",
      700: "#7e22ce",
      800: "#6b21a8",
      900: "#581c87",
      950: "#3b0764"
    }
  },

  // Semantic Status Palettes
  semantic: {
    success: {
      bg: "rgba(6, 78, 59, 0.6)",
      border: "rgba(4, 120, 87, 0.6)",
      text: "#34d399",
      dot: "#10b981",
      badgeBg: "#022c22",
      badgeText: "#6ee7b7",
      badgeBorder: "#065f46"
    },
    warning: {
      bg: "rgba(120, 53, 15, 0.6)",
      border: "rgba(180, 83, 9, 0.6)",
      text: "#fbbf24",
      dot: "#f59e0b",
      badgeBg: "#451a03",
      badgeText: "#fcd34d",
      badgeBorder: "#78350f"
    },
    danger: {
      bg: "rgba(136, 19, 55, 0.6)",
      border: "rgba(190, 18, 60, 0.6)",
      text: "#fb7185",
      dot: "#f43f5e",
      badgeBg: "#4c0519",
      badgeText: "#fda4af",
      badgeBorder: "#881337"
    },
    info: {
      bg: "rgba(12, 74, 110, 0.6)",
      border: "rgba(3, 105, 161, 0.6)",
      text: "#38bdf8",
      dot: "#0ea5e9",
      badgeBg: "#082f49",
      badgeText: "#7dd3fc",
      badgeBorder: "#0c4a6e"
    }
  },

  // Dark Theme Tokens (Default for EvidenceKit)
  dark: {
    background: "#09090b", // zinc-950
    foreground: "#f4f4f5", // zinc-100
    mutedBackground: "#18181b", // zinc-900
    mutedForeground: "#a1a1aa", // zinc-400
    card: "rgba(24, 24, 27, 0.6)", // zinc-900/60
    cardHover: "rgba(39, 39, 42, 0.6)", // zinc-800/60
    popover: "#18181b", // zinc-900
    popoverForeground: "#f4f4f5", // zinc-100
    border: "#27272a", // zinc-800
    borderSubtle: "#18181b", // zinc-900
    input: "#18181b", // zinc-900
    inputBorder: "#27272a", // zinc-800
    ring: "#3b82f6" // blue-500
  },

  // Light Theme Tokens
  light: {
    background: "#ffffff",
    foreground: "#09090b",
    mutedBackground: "#f4f4f5",
    mutedForeground: "#71717a",
    card: "#ffffff",
    cardHover: "#fafafa",
    popover: "#ffffff",
    popoverForeground: "#09090b",
    border: "#e4e4e7",
    borderSubtle: "#f4f4f5",
    input: "#ffffff",
    inputBorder: "#d4d4d8",
    ring: "#2563eb"
  }
} as const;

export const typography = {
  fontFamilies: {
    sans: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
  },
  fontSizes: {
    xs: { fontSize: "0.75rem", lineHeight: "1rem" }, // 12px
    sm: { fontSize: "0.875rem", lineHeight: "1.25rem" }, // 14px
    base: { fontSize: "1rem", lineHeight: "1.5rem" }, // 16px
    lg: { fontSize: "1.125rem", lineHeight: "1.75rem" }, // 18px
    xl: { fontSize: "1.25rem", lineHeight: "1.75rem" }, // 20px
    "2xl": { fontSize: "1.5rem", lineHeight: "2rem" }, // 24px
    "3xl": { fontSize: "1.875rem", lineHeight: "2.25rem" } // 30px
  },
  fontWeights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  }
} as const;

export const spacing = {
  0: "0rem",
  0.5: "0.125rem", // 2px
  1: "0.25rem", // 4px
  1.5: "0.375rem", // 6px
  2: "0.5rem", // 8px
  2.5: "0.625rem", // 10px
  3: "0.75rem", // 12px
  3.5: "0.875rem", // 14px
  4: "1rem", // 16px
  5: "1.25rem", // 20px
  6: "1.5rem", // 24px
  8: "2rem", // 32px
  10: "2.5rem", // 40px
  12: "3rem", // 48px
  16: "4rem" // 64px
} as const;

export const radii = {
  none: "0px",
  sm: "0.125rem", // 2px
  md: "0.375rem", // 6px
  lg: "0.5rem", // 8px
  xl: "0.75rem", // 12px
  "2xl": "1rem", // 16px
  full: "9999px"
} as const;

export const shadows = {
  none: "none",
  sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
  xl: "0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
  inner: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)"
} as const;

export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px"
} as const;

export const states = {
  focusRing: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
  focusRingDark: "focus-visible:ring-blue-500 focus-visible:ring-offset-zinc-950",
  disabled: "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
  transition: "transition-colors duration-150 ease-in-out"
} as const;

export const tokens = {
  colors,
  typography,
  spacing,
  radii,
  shadows,
  breakpoints,
  states
} as const;

export type Tokens = typeof tokens;
