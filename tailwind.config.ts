import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    darkMode: 'class',
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                    neon: "#3BC9F5",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                    neon: "#9D4EDD",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                // Custom Homepage Colors
                "neon-blue": "#2d6af2",
                "neon-green": "#00ff9d",
                "background-dark": "#02040a",
                "card-bg": "#0a101f",
                "glass": "rgba(10, 16, 31, 0.8)",
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
                'xl': "1rem",
                '2xl': "1.5rem",
                '3xl': "2rem",
            },
            fontFamily: {
                display: ['"Press Start 2P"', 'var(--font-press-start-2p)', 'cursive'],
                body: ['"Rajdhani"', 'var(--font-rajdhani)', 'sans-serif'],
            },
            boxShadow: {
                'neon-blue': '0 0 10px #3BC9F5, 0 0 20px #3BC9F5',
                'neon-green': '0 0 10px #00ff9d, 0 0 20px #00ff9d',
                'neon-glow': '0 0 15px rgba(59, 201, 245, 0.5), 0 0 30px rgba(59, 201, 245, 0.3)',
                'card-glow-blue': '0 0 25px rgba(45, 106, 242, 0.25), inset 0 0 10px rgba(45, 106, 242, 0.1)',
                'card-glow-green': '0 0 25px rgba(0, 255, 157, 0.25), inset 0 0 10px rgba(0, 255, 157, 0.1)',
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
            },
        },
    },
    plugins: [],
};

export default config;
