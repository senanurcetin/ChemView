import type { Metadata } from 'next';
import { Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-space-grotesk',
});

export const metadata: Metadata = {
  title: 'ChemView | NEXUS 2.0 Synthetic Mixing HMI',
  description: 'ChemView by NEXUS — a simulated industrial mixing-process HMI and digital twin.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${spaceGrotesk.variable}`}>
      <body className="font-body antialiased bg-background text-foreground overflow-x-hidden min-h-screen">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
