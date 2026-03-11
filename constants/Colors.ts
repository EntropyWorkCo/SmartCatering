const tintColorLight = "#74CF62";
const tintColorDark = "#74CF62";

export default {
  light: {
    text: "#0f172a",          // Dark slate for text
    background: "#f8fafc",    // Very light slate for background
    surface: "#ffffff",       // White cards
    surfaceBorder: "#e2e8f0", // Light border
    muted: "#64748b",         // Gray text
    tint: tintColorLight,
    tabIconDefault: "#cbd5e1",
    tabIconSelected: tintColorLight,
    primary: "#74CF62",
    danger: "#ef4444",
    dangerBg: "#fef2f2",
    dangerBorder: "#fecaca",
    info: "#3b82f6",
    infoBg: "#eff6ff",
    infoBorder: "#bfdbfe",
    cardHighlight: "#f0fdf4"  // Light green highlight
  },
  dark: {
    text: "#ffffff",          // Pure white text
    background: "#020617",    // Deep slate background (OLED friendly)
    surface: "#0f172a",       // Darker cards
    surfaceBorder: "#1e293b", // Dark borders
    muted: "#94a3b8",         // Muted gray
    tint: tintColorDark,
    tabIconDefault: "#475569",
    tabIconSelected: tintColorDark,
    primary: "#74CF62",
    danger: "#f87171",
    dangerBg: "#450a0a",
    dangerBorder: "#7f1d1d",
    info: "#60a5fa",
    infoBg: "#172554",
    infoBorder: "#1e3a8a",
    cardHighlight: "#064e3b"  // Dark green highlight
  },
};
