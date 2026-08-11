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
      },
      keyframes: {
        // Chat surface — the chat-bubble entrance animation.
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
        // Transcript review deck — the waiting-feedback lock breathes
        // (Lovable spec §2). Only ever on a chunk with pending feedback.
        "lock-breathe": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.1)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.5s ease-out both",
        "voice-dot": "voice-dot 1.2s ease-in-out infinite",
        "lock-breathe": "lock-breathe 2s ease-in-out infinite",
      },
      colors: {
        background: "hsl(var(--background))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
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
        // Willab chat (funnel) — bot bubble
        "chat-bot": "hsl(var(--chat-bubble-bot))",
        // Success-emerald valence colour, distinct from the generic
        // destructive so the valence is meaningful at a glance.
        success: "hsl(var(--success))",
        // Transcript review deck — pending-feedback amber + applied
        // colour-emphasis (see globals.css for the restraint rationale).
        pending: "hsl(var(--pending))",
        emphasis: "hsl(var(--emphasis))",
        // Live capture — the pulsing dot, the stop button, an overrun
        // clock. NOT --destructive: recording is not an error state (see
        // globals.css for the full rationale).
        record: {
          DEFAULT: "hsl(var(--record))",
          foreground: "hsl(var(--record-foreground))",
        },
      },
    },
  },
  plugins: [],
};

export default config;

