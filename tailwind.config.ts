import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ["var(--font-dm-serif)", "DM Serif Display", "serif"],
        body: ["var(--font-dm-sans)", "DM Sans", "sans-serif"],
      },
      minHeight: {
        "question-box": "min(180px, 40vw)",
      },
      keyframes: {
        "question-fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-short": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // Chat surface — pulsing ring around the active record button
        // and the chat-bubble entrance animation.
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(1.8)", opacity: "0" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // WillpowerLab logo — three-dot voice rhythm. Each dot in
        // the Logo SVG uses this keyframe with a staggered delay so
        // the mark reads as "active voice." Idle state holds dots
        // static; reduced-motion users get the static form (the CSS
        // override in globals.css).
        "voice-dot": {
          "0%, 100%": { transform: "scaleY(1)" },
          "50%": { transform: "scaleY(0.6)" },
        },
      },
      animation: {
        "question-in": "question-fade-in 0.25s ease-out forwards",
        "fade-in": "fade-in 0.4s ease-out forwards",
        "fade-in-short": "fade-in-short 0.2s ease-out forwards",
        "pulse-ring":
          "pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite",
        "fade-in-up": "fade-in-up 0.5s ease-out both",
        "voice-dot": "voice-dot 1.2s ease-in-out infinite",
      },
      colors: {
        background: "hsl(var(--background))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        "step-completed": "hsl(var(--step-completed))",
        "step-pending": "hsl(var(--step-pending))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        border: "hsl(var(--border))",
        /* Journal audio/media panel — one warm off-white, neutral by design. */
        "journal-media": "hsl(var(--journal-media))",
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        secondary: "hsl(var(--secondary, var(--muted)))",
        email: {
          bg: "hsl(var(--email-bg))",
          divider: "hsl(var(--email-divider))",
        },
        // Willab chat (funnel) — bubbles + recording-state highlight
        "chat-bot": "hsl(var(--chat-bubble-bot))",
        "chat-user": "hsl(var(--chat-bubble-user))",
        "chat-user-foreground": "hsl(var(--chat-bubble-user-foreground))",
        "recording-pulse": "hsl(var(--recording-pulse))",
        // Chat-slot semantic colours (Single-Slot UI spec). Charisma /
        // Stress in the CharismaStress slot use these instead of the
        // generic destructive so the valence is meaningful at a glance.
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        danger: {
          DEFAULT: "hsl(var(--danger))",
          foreground: "hsl(var(--danger-foreground))",
        },
      },
    },
  },
  plugins: [],
};

export default config;

