/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F7F8F8",
        surface: "#FFFFFF",
        "surface-2": "#FBFBFC",
        "surface-sunken": "#F1F3F3",
        ink: "#11201E",
        "ink-2": "#3C4B49",
        muted: "#6B7A78",
        faint: "#8D9997",
        line: "#E3E7E7",
        "line-strong": "#D2D8D8",
        accent: "#0E7C6B",
        "accent-hover": "#17A589",
        "accent-tint": "#E6F5F2",
        "accent-ink": "#0A5D50",
        danger: "#B42318",
        "danger-tint": "#FEF0EE",
        "danger-line": "#F5C9C3",
        warn: "#9A5B08",
        "warn-tint": "#FEF6E7",
        "warn-line": "#F3DCB0",
        success: "#146C43",
        "success-tint": "#E8F5EE",
        "success-line": "#BFE0CD",
        "gray-tint": "#EEF0F0",
      },
      fontFamily: {
        sans: ["Inter Tight", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: {
        sm: "5px",
        DEFAULT: "7px",
        lg: "10px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(17,32,30,.06)",
        card: "0 1px 3px rgba(17,32,30,.07), 0 8px 24px -12px rgba(17,32,30,.14)",
      },
    },
  },
  plugins: [],
};
