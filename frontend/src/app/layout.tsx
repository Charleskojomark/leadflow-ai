import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'LeadFlow AI — AI-Powered Lead Discovery & Cold Outreach Platform',
  description: 'Production-ready Lead Extraction, Email Validation, and Cold Outreach Automation SaaS',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full bg-[#06090e]">
      <body className="min-h-full bg-[#06090e] text-slate-100 antialiased font-sans">
        <div className="flex min-h-screen">
          <Sidebar apiStatus="healthy" />
          <div className="flex-1 ml-64 flex flex-col min-h-screen">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
