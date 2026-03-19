import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';
import { StatusPill } from '@/components/StatusPill';

export const metadata: Metadata = {
  title: 'Asmita Builders - Feasibility Generator',
  description: 'AI-powered redevelopment feasibility reports built on UDCPR-2020',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // The report is a dense financial table; users need to be able to zoom it.
  maximumScale: 5,
  themeColor: '#1d67f1',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="no-print sticky top-0 z-30 border-b border-ink-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[1800px] items-center gap-2 px-3 sm:gap-6 sm:px-5">
            <Link href="/" className="flex shrink-0 items-center gap-2 sm:gap-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-brand-600 text-[13px] font-bold text-white">
                A
              </span>
              <span className="text-[13px] font-semibold tracking-tight text-ink-900 sm:text-[14px]">
                Asmita
                <span className="hidden sm:inline"> Builders</span>
                <span className="ml-2 hidden font-normal text-ink-400 lg:inline">Feasibility Generator</span>
              </span>
            </Link>

            <nav className="flex items-center gap-0.5 text-[13px] sm:gap-1">
              <Link href="/" className="rounded-md px-2 py-1.5 text-ink-600 hover:bg-ink-100 hover:text-ink-900 sm:px-2.5">
                New
                <span className="hidden sm:inline"> report</span>
              </Link>
              <Link
                href="/history"
                className="rounded-md px-2 py-1.5 text-ink-600 hover:bg-ink-100 hover:text-ink-900 sm:px-2.5"
              >
                History
              </Link>
            </nav>

            <div className="ml-auto shrink-0">
              <StatusPill />
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
