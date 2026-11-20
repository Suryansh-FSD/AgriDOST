import type { Metadata } from 'next';
import { Manrope, Inter } from 'next/font/google';
import './globals.css';

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AgriDOST — AI-Powered Precision Agriculture & Farm Intelligence OS',
  description:
    'A farmer maps their land once, and AgriDOST uses that same map to manage the entire farm: smart mapping, crop planning, boundary trees, AI leaf health, and precision drone spraying.',
  keywords: [
    'AgriDOST',
    'Precision Agriculture',
    'Smart Farm Mapping',
    'AI Crop Planner',
    'Gemini Crop Health',
    'Drone Spray Planning',
    'Indian Agriculture',
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#F7F7F0] text-[#26312A] font-sans">
        {children}
      </body>
    </html>
  );
}
