import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        border: "hsl(215 27.9% 16.9%)",
        background: "hsl(222.2 84% 4.9%)",
        foreground: "hsl(210 40% 98%)",
        card: "hsl(222.2 84% 6%)",
        muted: "hsl(217.2 32.6% 17.5%)",
        accent: "hsl(217.2 32.6% 25%)",
        destructive: "hsl(0 62.8% 30.6%)"
      }
    }
  },
  plugins: []
};
export default config;
