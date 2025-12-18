// client/src/hooks/useSolanaWallet.ts

import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from "@solana/web3.js";

export interface SolanaWalletAdapter {
    publicKey: PublicKey;
    signTransaction: (transaction: any) => Promise<any>;
    signAllTransactions: (transactions: any[]) => Promise<any[]>;
    signMessage: (message:  Uint8Array) => Promise<Uint8Array>;
    connecting: boolean;
    connected: boolean;
    // ... other properties
}

export function useSolanaWallet() {
    const standardWallet = useWallet(); // ← From WalletProvider

    return {
        wallet: standardWallet as any,
        publicKey: (standardWallet. publicKey as PublicKey) ??  null,
        connected: !! standardWallet.connected,
        isLoading: !!standardWallet.connecting,
        signMessage: standardWallet.signMessage,
        signTransaction: standardWallet.signTransaction,
        signAllTransactions: standardWallet.signAllTransactions,
        userEmail: undefined // Placeholder for future Civic integration
    };
}