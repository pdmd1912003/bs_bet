"use client";
import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import Navbar from "../components/Navbar";
import '@solana/wallet-adapter-react-ui/styles.css';
import PriceTracker from "../components/PriceTracker";
import BetForm from "../components/BetForm";
// Import Tailwind styles
import '../styles/globals.css';

function Layout({ children }: { children: React.ReactNode }) {
  // RPC endpoint from env
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL 
    || "https://api.devnet.solana.com";
  
  // Define supported wallets
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),   // ← Phantom wallet
      new SolflareWalletAdapter(),  // ← Solflare wallet
    ],
    []
  );

  return (
    <html lang="en">
      <body className="bg-gray-800 min-h-screen text-gray-100">
        {/* Step 1: Provide Solana connection */}
        <ConnectionProvider endpoint={endpoint}>
          {/* Step 2: Provide wallet context */}
          <WalletProvider 
            wallets={wallets} 
            autoConnect  // ← Auto-connect on page load
          >
            {/* Step 3: Provide wallet modal UI */}
            <WalletModalProvider>
              <div className="container mx-auto px-4 py-8 max-w-5xl">
                <Navbar />  {/* ← Navbar has WalletMultiButton */}
                <div className="flex flex-col md:flex-row gap-8">
                  <PriceTracker />
                  <BetForm />
                </div>
                <main className="mt-8">
                  {children}
                </main>
              </div>
            </WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      </body>
    </html>
  )
}

export default Layout;