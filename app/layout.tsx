// app/layout.tsx
import './globals.css';
import '../styles/tailwind.css';
import type { ReactNode } from 'react';
import WalletConnect from '../components/WalletConnect';
import NotificationBell from '../components/NotificationBell';
import WagmiProviders from '../providers/WagmiProviders';
import ToastContainer from '../components/Toast'; // <-- added

export const metadata = {
  title: 'BlockTalk — AI Wallet Co-Pilot',
  description: 'Chat with your wallet — transactions, gas, PnL, DAO reminders.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WagmiProviders>
          {/* Top navigation (fixed) */}
          <header className="top-nav" role="banner">
            <div className="nav-inner">
              <div className="nav-left">
                <a className="nav-logo" href="/" aria-label="BlockTalk home">BlockTalk</a>
              </div>

              <nav className="nav-center" aria-label="Main navigation">
                <a className="nav-link" href="#">Docs</a>
                <a className="nav-link" href="#">About</a>
              </nav>

              <div className="nav-right">
                <NotificationBell />
                <WalletConnect />
              </div>
            </div>
          </header>

          {/* page content */}
          <main>{children}</main>

          {/* Global toast container (single mount) */}
          <ToastContainer />
        </WagmiProviders>
      </body>
    </html>
  );
}
