'use client';

import React, { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';

export function ShellLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        apiStatus="healthy"
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main content — offset by sidebar width only on desktop */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen min-w-0">
        {/* Inject the toggle handler into children via a context or pass via cloneElement */}
        {/* We use a global custom event instead to keep pages clean */}
        <div
          id="shell-main"
          data-mobile-menu-toggle="true"
          className="flex-1 flex flex-col"
          onClick={(e) => {
            // Detect clicks on elements with data-toggle-mobile-menu
            const target = e.target as HTMLElement;
            if (target.closest('[data-toggle-mobile-menu]')) {
              setMobileOpen(true);
            }
          }}
        >
          {/* Pass toggle via window event — pages fire this from Navbar hamburger */}
          <MobileMenuBridge onToggle={() => setMobileOpen((v) => !v)} />
          {children}
        </div>
      </div>
    </div>
  );
}

// Bridge: listens for a custom DOM event that Navbar can fire
function MobileMenuBridge({ onToggle }: { onToggle: () => void }) {
  React.useEffect(() => {
    const handler = () => onToggle();
    window.addEventListener('leadflow:toggle-mobile-menu', handler);
    return () => window.removeEventListener('leadflow:toggle-mobile-menu', handler);
  }, [onToggle]);
  return null;
}
