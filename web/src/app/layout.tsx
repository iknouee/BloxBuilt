import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BloxBuilt — Bloxburg Build Gallery',
  description:
    'Browse Bloxburg house builds and grab a Build ID. BloxBuilt auto-builds your dream home.',
  themeColor: '#0b1120',
  openGraph: {
    title: 'BloxBuilt — Bloxburg Build Gallery',
    description: 'Browse Bloxburg house builds and grab a Build ID.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Animated blueprint grid + glow, fixed behind everything */}
        <div className="bg-grid" aria-hidden />
        <div className="bg-glow" aria-hidden />
        {children}
      </body>
    </html>
  );
}
