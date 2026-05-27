import type { Metadata } from 'next';
import './globals.css';
import { Sidebar, MobileTopBar, MobileBottomBar } from '../components/Chrome';

export const metadata: Metadata = {
  title: 'VedaAI · AI Assessment Creator',
  description: 'Generate sectioned, difficulty-balanced question papers in seconds.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
          <Sidebar />
          <main className="flex-1 min-w-0">
            <MobileTopBar />
            {children}
          </main>
          <MobileBottomBar />
        </div>
      </body>
    </html>
  );
}
