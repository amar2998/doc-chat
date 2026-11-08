import './globals.css';
import PWA from '@/components/PWA';

export const metadata = {
  title: 'Dockside Chat',
  description: 'Real-time chat with file sharing',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Dockside', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
};
export const viewport = { themeColor: '#0b1220', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <PWA />
      </body>
    </html>
  );
}
