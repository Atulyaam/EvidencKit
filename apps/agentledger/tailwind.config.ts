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
        border: "hsl(240 5.9% 18%)",
        background: "hsl(240 10% 3.9%)",
        foreground: "hsl(0 0% 98%)",
        card: "hsl(240 10% 5%)",
        muted: "hsl(240 3.7% 15.9%)",
        accent: "hsl(240 3.7% 22%)",
        destructive: "hsl(0 62.8% 30.6%)"
      }
    }
  },
  plugins: []
};
export default config;
