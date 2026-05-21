import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HAIORA POS | Stype POS',
  description: 'HAIORA POS - Smart POS, Smart Business',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
