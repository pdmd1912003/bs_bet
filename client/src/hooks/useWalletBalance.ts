// client/src/hooks/useWalletBalance.ts

import { useState, useEffect } from 'react';
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useSolanaWallet } from './useSolanaWallet';

export function useWalletBalance() {
    const { publicKey } = useSolanaWallet();
    const [balance, setBalance] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchBalance = async () => {
            if (! publicKey) {
                setBalance(null);
                return;
            }

            setIsLoading(true);
            try {
                const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL 
                    || "https://api.devnet.solana.com";
                const connection = new Connection(rpcUrl, "confirmed");
                
                // Fetch SOL balance
                const lamports = await connection.getBalance(publicKey);
                setBalance(lamports / LAMPORTS_PER_SOL);
            } catch (error) {
                console.error("Error fetching balance:", error);
                setBalance(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchBalance();

        // Poll every 30 seconds
        const intervalId = setInterval(fetchBalance, 30000);

        return () => clearInterval(intervalId);
    }, [publicKey]); // Re-fetch when wallet changes

    return { balance, isLoading };
}