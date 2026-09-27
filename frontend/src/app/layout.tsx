import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ShellLayout } from '@/components/ShellLayout';

export const metadata: Metadata = {
  title: 'LeadFlow AI — AI-Powered Lead Discovery & Cold Outreach Platform',
  description: 'Production-ready Lead Extraction, Email Validation, and Cold Outreach Automation SaaS',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full bg-[#06090e]">
      <body className="min-h-full bg-[#06090e] text-slate-100 antialiased font-sans">
        <ShellLayout>{children}</ShellLayout>
      </body>
    </html>
  );
}
