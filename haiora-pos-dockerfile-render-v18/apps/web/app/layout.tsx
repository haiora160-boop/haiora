import type { Metadata } from 'next';
import './globals.css';
import { PwaRegister } from './pwa-register';

export const metadata: Metadata = {
  title: 'HAIORA POS',
  description: 'HAIORA POS - Smart POS, Smart Business',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }]
  },
  appleWebApp: {
    capable: true,
    title: 'HAIORA POS',
    statusBarStyle: 'default'
  }
};

export const viewport = {
  themeColor: '#6b3f00',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body><PwaRegister />{children}</body>
    </html>
  );
}
