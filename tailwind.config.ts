import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        utama: "#0F766E", lembut: "#CCFBF1", aksen: "#2563EB", latar: "#F8FAFC",
        bingkai: "#E2E8F0", teks: "#0F172A", sukses: "#16A34A", error: "#DC2626",
      },
      fontFamily: { sans: ["var(--font-jakarta)", "sans-serif"] },
      borderRadius: { kontrol: "10px", kartu: "16px" },
    },
  },
  plugins: [],
} satisfies Config;
