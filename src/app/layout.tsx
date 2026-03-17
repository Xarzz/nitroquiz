import type { Metadata } from "next";
import { Inter, Orbitron, Rajdhani, Press_Start_2P } from "next/font/google";
import NextTopLoader from 'nextjs-toploader';
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: '--font-inter',
});

const orbitron = Orbitron({
  subsets: ["latin"],
  display: "swap",
  variable: '--font-orbitron',
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ['400', '500', '600', '700'],
  display: "swap",
  variable: '--font-rajdhani',
});

const pressStart2P = Press_Start_2P({
  weight: '400',
  subsets: ["latin"],
  display: "swap",
  variable: '--font-press-start-2p',
});

export const metadata: Metadata = {
  title: "NitroQuiz - Balap Cerdas Adrenalin Tinggi",
  description: "Game kuis seru berkecepatan tinggi! Jawab pertanyaan, nyalakan nitro, dan jadilah juara di NitroQuiz.",
  keywords: ["edukasi", "game", "quiz", "balapan", "racing", "belajar", "nitro", "turbo"],
  authors: [{ name: "NitroQuiz Team" }],
  openGraph: {
    title: "NitroQuiz - Balap Cerdas Adrenalin Tinggi",
    description: "Game kuis seru berkecepatan tinggi! Jawab pertanyaan, nyalakan nitro, dan jadilah juara.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        {/* Fonts are loaded via next/font/google - no CDN links needed */}
      </head>
      <body className={`${inter.variable} ${orbitron.variable} ${rajdhani.variable} ${pressStart2P.variable}`}>
        <NextTopLoader
          color="#2d6af2"
          initialPosition={0.08}
          crawlSpeed={200}
          height={4}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px #2d6af2,0 0 5px #2d6af2"
        />
        {children}
      </body>
    </html>
  );
}
