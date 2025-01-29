import type { Config } from "tailwindcss"

const config = {
  content: [
    "./src/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}", 
    "./src/pages/**/*.{ts,tsx}"
  ],
  darkMode: "class",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        sm: "640px",
        md: "768px", 
        lg: "1024px",
        xl: "1280px"
      }
    },
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",
        secondary: "var(--secondary)", 
        "secondary-foreground": "var(--secondary-foreground)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        accent: "var(--accent)",
        "accent-foreground": "var(--accent-foreground)",
        destructive: "var(--destructive)",
        "destructive-foreground": "var(--destructive-foreground)",
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)"
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      zIndex: {
        overlay: "400",
        modal: "300", 
        dropdown: "200",
        base: "100"
      },
      spacing: {
        xs: "4px",
        sm: "8px", 
        md: "16px",
        lg: "24px",
        xl: "32px",
        "2xl": "48px"
      }
    }
  },
  plugins: []
} satisfies Config

export default config