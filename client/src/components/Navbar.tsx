// client/src/components/Navbar.tsx

"use client";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { useSolanaWallet } from "../hooks/useSolanaWallet";
import { useWalletBalance } from "../hooks/useWalletBalance";

// Dynamic import to avoid SSR issues
const WalletMultiButton = dynamic(
    () => import("@solana/wallet-adapter-react-ui")
        .then((m) => m.WalletMultiButton),
    { ssr: false }  // ← Disable server-side rendering
);

export default function Navbar() {
    const { publicKey, connected } = useSolanaWallet();
    const { balance, isLoading } = useWalletBalance();
    const [copied, setCopied] = useState(false);

    // Copy wallet address to clipboard
    const copyToClipboard = () => {
        if (publicKey) {
            navigator.clipboard.writeText(publicKey.toString());
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // Format address:   "Abc1... xyz9"
    const formatAddress = (address: string) => {
        return `${address.slice(0, 4)}...${address.slice(-4)}`;
    };

    return (
        <nav className="w-full border rounded-md shadow flex items-center justify-between px-8 py-4">
            {/* Left side:  Wallet info */}
            <div className="text-1xl font-bold text-white">
                <div className="flex items-center gap-4">
                    {connected && publicKey && (
                        <div className="flex flex-col items-end">
                            {/* Clickable address */}
                            <button
                                onClick={copyToClipboard}
                                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors flex items-center gap-2"
                            >
                                <span>{formatAddress(publicKey.toString())}</span>
                                <span>{copied ? "✓" : "📋"}</span>
                            </button>
                            
                            {/* Balance display */}
                            <div className="text-sm text-white mt-1">
                                {isLoading ? (
                                    <span>Loading...</span>
                                ) : balance !== null ? (
                                    <span>{balance. toFixed(4)} SOL</span>
                                ) : (
                                    <span>--</span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right side: Wallet button */}
            <div className="flex items-center gap-2">
                {/* 🔴 THIS IS THE WALLET CONNECT BUTTON */}
                <WalletMultiButton />
            </div>
        </nav>
    );
}