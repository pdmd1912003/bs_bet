import React, { useEffect, useState, useCallback, useRef } from "react";
import UserProfile from "./UserProfile";
import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import idlJson from './bs_bet.json';
import type { BsBet } from './bs_bet';
import { BN } from "@coral-xyz/anchor";
import { Connection as SolanaConnection, PublicKey, SystemProgram, Keypair, Transaction } from "@solana/web3.js";
import { useSolanaWallet } from "../hooks/useSolanaWallet";
import { signAndFormatMessage } from "../utils/signUtils";

// Civic interfaces - Commented out, using standard wallet adapter
// interface CivicWallet {
//     publicKey: PublicKey;
//     signTransaction: (transaction: Transaction) => Promise<Transaction>;
//     signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>;
//     signMessage: (message: Uint8Array) => Promise<Uint8Array>;
// }
//
// interface CivicUser {
//     wallet: CivicWallet;
// }

export type ClientActiveBet = { /* ... (same as before) ... */ };
// Read constants from environment variables
const PYTH_SOL_USD_PRICE_ACCOUNT = new anchor.web3.PublicKey(
    process.env.NEXT_PUBLIC_PYTH_SOL_USD_PRICE_ACCOUNT || "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE"
);
// MagicBlock RPC Endpoint
const MAGICBLOCK_RPC_ENDPOINT = process.env.NEXT_PUBLIC_MAGICBLOCK_RPC_URL || "https://devnet.magicblock.app/";

interface DisplayableActiveBet extends ClientActiveBet { publicKey: string; }

// First, let's add a utility function at the beginning of the file after imports
const formatActionFeedbackMessage = (message: string) => {
    // For messages from handleBet that follow the format "Tx: {signature} via {provider}"
    if (message.startsWith("Tx: ")) {
        const parts = message.split(" via ");
        if (parts.length === 2) {
            const txSig = parts[0].replace("Tx: ", "");
            const viaText = parts[1];

            return (
                <span>
                    Tx: <a
                        href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                    >
                        {txSig.substring(0, 12)}...{txSig.substring(txSig.length - 4)}
                    </a> via {viaText}
                </span>
            );
        }
    }

    // For messages that contain "Tx: {signature}" anywhere in the text (like delegation success messages)
    const txMatch = message.match(/Tx:\s*([a-zA-Z0-9]{43,})/);
    if (txMatch && txMatch[1]) {
        const txSig = txMatch[1];
        const beforeTx = message.split(`Tx: ${txSig}`)[0];

        return (
            <span>
                {beforeTx}Tx: <a
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                >
                    {txSig.substring(0, 12)}...{txSig.substring(txSig.length - 4)}
                </a>
            </span>
        );
    }

    // If not a transaction message, return as is
    return message;
};

export default function BetForm() {
    const [feedback, setFeedback] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [actionFeedbackMessage, setActionFeedbackMessage] = useState<string>("");

    // Use our custom hook to get the wallet
    const { wallet: userWallet, publicKey: userPublicKey, connected } = useSolanaWallet();
    const userAuthority = userPublicKey;

    // Standard L1 Connection
    const [standardConnection, setStandardConnection] = useState<SolanaConnection | null>(null);

    // Initialize connection
    useEffect(() => {
        const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
        const connection = new SolanaConnection(rpcUrl, "confirmed");
        setStandardConnection(connection);
    }, []);

    // Standard L1 Program & Provider
    const [l1Program, setL1Program] = useState<Program<BsBet> | null>(null);
    const [l1Provider, setL1Provider] = useState<AnchorProvider | null>(null);

    // --- NEW: Ephemeral Program & Provider (for MagicBlock) ---
    const [ephemeralProgram, setEphemeralProgram] = useState<Program<BsBet> | null>(null);
    const ephemeralProviderRef = useRef<AnchorProvider | null>(null); // Use ref to avoid re-triggering useEffects excessively

    const [userProfilePda, setUserProfilePda] = useState<PublicKey | null>(null);
    const [userAuthStatePda, setUserAuthStatePda] = useState<PublicKey | null>(null);
    const [activeBetPda, setActiveBetPda] = useState<PublicKey | null>(null);
    const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null);
    const [authStateData, setAuthStateData] = useState<Record<string, unknown> | null>(null);
    const [displayableBets, setDisplayableBets] = useState<DisplayableActiveBet[]>([]);

    const userPoints = profileData ? Number(profileData.points) : 1000;
    const fixedBetAmount = 10;
    const isProfileInitialized = !!profileData;
    const isDelegated = authStateData ? authStateData.isDelegated : false;

    // Modified to use userWallet
    // Effect for L1 Anchor Provider & Program
    useEffect(() => {
        if (userWallet && standardConnection && userAuthority) {
            const providerWallet: Wallet = {
                publicKey: userAuthority,
                signTransaction: userWallet.signTransaction,
                signAllTransactions: userWallet.signAllTransactions,
                payer: new Keypair()
            };
            const newL1Provider = new AnchorProvider(standardConnection, providerWallet, AnchorProvider.defaultOptions());
            setL1Provider(newL1Provider);
            if (idlJson) {
                const newL1Program = new Program(idlJson, newL1Provider) as Program<BsBet>;
                setL1Program(newL1Program);
                console.log("L1 Program client created.");
            }
        } else {
            setL1Provider(null);
            setL1Program(null);
        }
    }, [userWallet, standardConnection, userAuthority]);

    // --- NEW: Effect for Ephemeral Provider & Program ---
    useEffect(() => {
        if (userWallet && userAuthority) {
            if (ephemeralProviderRef.current && ephemeralProviderRef.current.connection.rpcEndpoint === MAGICBLOCK_RPC_ENDPOINT) {
                // If already initialized with the same endpoint, and program exists, do nothing
                if (ephemeralProgram) return;
            }

            console.log("Initializing Ephemeral Provider & Program for MagicBlock...");
            const ephemeralSolanaConnection = new SolanaConnection(MAGICBLOCK_RPC_ENDPOINT, "confirmed");
            const ephemeralWallet: Wallet = { // Use the connected user's wallet
                publicKey: userAuthority,
                signTransaction: userWallet.signTransaction,
                signAllTransactions: userWallet.signAllTransactions,
                payer: new Keypair()
            };
            const newEphemeralProvider = new AnchorProvider(ephemeralSolanaConnection, ephemeralWallet, AnchorProvider.defaultOptions());
            ephemeralProviderRef.current = newEphemeralProvider; // Store in ref

            const newEphemeralProgram = new Program(idlJson, newEphemeralProvider) as Program<BsBet>;
            setEphemeralProgram(newEphemeralProgram);
            console.log("Ephemeral Program client created for MagicBlock RPC.");
        } else {
            ephemeralProviderRef.current = null;
            setEphemeralProgram(null);
        }
    }, [userWallet, userAuthority, ephemeralProgram]);

    // Effect for PDA Derivation (uses L1 program, as PDAs are on L1)
    useEffect(() => {
        if (l1Program && userAuthority) {
            // ... (PDA derivation logic - same as before, uses l1Program.programId) ...
            setActionFeedbackMessage('Deriving PDAs...');
            try {
                const [profilePdaRet] = anchor.web3.PublicKey.findProgramAddressSync(
                    [Buffer.from("profile"), userAuthority.toBuffer()], l1Program.programId
                );
                setUserProfilePda(profilePdaRet);
                const [authStatePdaRet] = anchor.web3.PublicKey.findProgramAddressSync(
                    [Buffer.from("auth_state"), userAuthority.toBuffer()], l1Program.programId
                );
                setUserAuthStatePda(authStatePdaRet);

                const [activeBetPdaRet] = anchor.web3.PublicKey.findProgramAddressSync(
                    [Buffer.from("active_bet"), userAuthority.toBuffer()], l1Program.programId
                );
                setActiveBetPda(activeBetPdaRet);
                setActionFeedbackMessage('PDAs derived.');
            } catch (error) {
                console.error("Error deriving PDAs:", error);
            }
        } else {
            setUserProfilePda(null);
            setUserAuthStatePda(null);
            setActiveBetPda(null);
        }
    }, [l1Program, userAuthority, userWallet]);

    // Fetch functions use L1 program to get ground truth state
    const fetchUserProfileData = useCallback(async () => {
        if (!l1Program || !userProfilePda) return;
        try {
            const data = await l1Program.account.userProfile.fetch(userProfilePda);
            setProfileData(data);
        }
        catch (e) {
            // When delegated to MagicBlock, the owner may not be our program, so Anchor fetch can fail.
            // Fallback: getAccountInfo + coder decode (works regardless of owner).
            try {
                const info = await l1Program.provider.connection.getAccountInfo(userProfilePda, { commitment: "confirmed" });
                if (!info) {
                    setProfileData(null);
                    return;
                }
                const decoded = l1Program.coder.accounts.decode<any>("userProfile", info.data);
                setProfileData(decoded);
            } catch (inner) {
                setProfileData(null);
                console.warn("Fetch profile L1 error", e);
                console.warn("Fetch profile fallback decode error", inner);
            }
        }
    }, [l1Program, userProfilePda]);

    const fetchUserAuthStateData = useCallback(async () => {
        if (!l1Program || !userAuthStatePda) return;
        try {
            const data = await l1Program.account.userAuthState.fetch(userAuthStatePda);
            setAuthStateData(data);
        }
        catch (e: any) {
            // When delegated to MagicBlock, the owner may not be our program, so Anchor fetch can fail.
            // Fallback: getAccountInfo + coder decode (works regardless of owner).
            try {
                const info = await l1Program.provider.connection.getAccountInfo(userAuthStatePda, { commitment: "confirmed" });
                if (!info) {
                    setAuthStateData(null);
                    return;
                }
                const decoded = l1Program.coder.accounts.decode<any>("userAuthState", info.data);
                setAuthStateData(decoded);
            } catch (inner: any) {
                setAuthStateData(null);
                console.warn("Fetch auth L1 error:", e?.message || e);
                console.warn("Fetch auth fallback decode error:", inner?.message || inner);
            }
        }
    }, [l1Program, userAuthStatePda]);

    useEffect(() => { // Auto-fetch
        if (userProfilePda && l1Program) {
            fetchUserProfileData();
        }
        if (userAuthStatePda && l1Program) {
            fetchUserAuthStateData();
        }
    }, [userProfilePda, userAuthStatePda, l1Program, fetchUserProfileData, fetchUserAuthStateData]);

    const handleCreateUserProfile = useCallback(async () => {
        if (!l1Program || !userAuthority || !userProfilePda || !userAuthStatePda || !activeBetPda) {
            setActionFeedbackMessage("Program not ready");
            return;
        }
        
        setLoading(true);
        setActionFeedbackMessage("Creating profile...");
        
        try {
            console.log("🚀 Calling create_user_profile instruction");
            console.log("UserProfilePda:", userProfilePda.toBase58());
            console.log("UserAuthStatePda:", userAuthStatePda.toBase58());
            console.log("ActiveBetPda:", activeBetPda.toBase58());
            console.log("UserAuthority:", userAuthority.toBase58());
            
            const tx = await l1Program.methods.createUserProfile()
                .accounts({
                    payer: userAuthority,
                    userProfile: userProfilePda,
                    userAuthStateForProfileCreation: userAuthStatePda,
                    activeBet: activeBetPda,
                    userAuthority: userAuthority,
                    systemProgram: SystemProgram.programId,
                } as any)
                .rpc({ commitment: "confirmed" });
            
            console.log("✅ Profile created! Tx:", tx);
            setActionFeedbackMessage(`Profile initialized! Tx: ${tx}`);
            
            // Wait for confirmation and fetch data
            await new Promise(resolve => setTimeout(resolve, 2000));
            await fetchUserProfileData();
            await fetchUserAuthStateData();
            
        } catch (err: any) {
            console.error("❌ Error creating user profile:", err);
            
            // Check if accounts already exist
            if (err.message?.includes("already in use") || err.message?.includes("custom program error: 0x0")) {
                setActionFeedbackMessage("Profile already exists! Refreshing data...");
                await fetchUserProfileData();
                await fetchUserAuthStateData();
            } else {
                setActionFeedbackMessage(`Failed: ${err.message || String(err)}`);
            }
        } finally {
            setLoading(false);
        }
    }, [l1Program, userAuthority, userProfilePda, userAuthStatePda, activeBetPda, fetchUserProfileData, fetchUserAuthStateData]);

    const fetchAndDisplayActiveBets = useCallback(async () => {
        if (!l1Program || !userAuthority || !activeBetPda) {
            setDisplayableBets([]);
            return;
        }

        try {
            const info = await l1Program.provider.connection.getAccountInfo(activeBetPda, { commitment: "confirmed" });
            if (!info) {
                setDisplayableBets([]);
                return;
            }

            const decoded = l1Program.coder.accounts.decode<any>("activeBet", info.data);
            setDisplayableBets([
                {
                    ...(decoded as any),
                    publicKey: activeBetPda.toBase58(),
                } as any,
            ]);
        } catch (e) {
            console.warn("Fetch active bet error", e);
            setDisplayableBets([]);
        }
    }, [l1Program, userAuthority, activeBetPda]);

    useEffect(() => { if (l1Program && userAuthority) fetchAndDisplayActiveBets(); }, [l1Program, userAuthority, fetchAndDisplayActiveBets]);

    // MagicBlock Delegation Program ID
    const MAGICBLOCK_DELEGATION_PROGRAM_ID = new anchor.web3.PublicKey(
        process.env.NEXT_PUBLIC_MAGICBLOCK_DELEGATION_PROGRAM_ID || "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
    );

    // Required by #[commit] ephemeral instructions in the IDL. Defaults come from the IDL.
    const MAGICBLOCK_MAGIC_PROGRAM_ID = new anchor.web3.PublicKey(
        process.env.NEXT_PUBLIC_MAGICBLOCK_MAGIC_PROGRAM_ID || "Magic11111111111111111111111111111111111111"
    );
    const MAGICBLOCK_MAGIC_CONTEXT = new anchor.web3.PublicKey(
        process.env.NEXT_PUBLIC_MAGICBLOCK_MAGIC_CONTEXT || "MagicContext1111111111111111111111111111111"
    );

    const handleDelegate = async () => {
        if (!l1Program || !userAuthority || !userProfilePda || !userAuthStatePda || !activeBetPda || !userWallet?.signMessage) {
            setActionFeedbackMessage("Wallet/Program not ready for delegation.");
            setLoading(false); return;
        }

        setLoading(true);
        setActionFeedbackMessage("Checking current delegation status...");

        try {
            // ========== DEBUG: CHECK BOTH ACCOUNTS ==========
            console.log("🔍 Checking accounts...");
            console.log("UserProfilePda:", userProfilePda?.toBase58());
            console.log("UserAuthStatePda:", userAuthStatePda?.toBase58());
            console.log("ActiveBetPda:", activeBetPda?.toBase58());
            
            // Check UserProfile first
            const profileAccountInfo = await l1Program.provider.connection.getAccountInfo(userProfilePda!);
            console.log("UserProfile exists?", profileAccountInfo !== null);

            // Check ActiveBet
            const activeBetAccountInfo = await l1Program.provider.connection.getAccountInfo(activeBetPda);
            console.log("ActiveBet exists?", activeBetAccountInfo !== null);
            
            // Check UserAuthState
            const authStateAccountInfo = await l1Program.provider.connection.getAccountInfo(userAuthStatePda);
            console.log("UserAuthState exists?", authStateAccountInfo !== null);
            console.log("UserAuthState owner:", authStateAccountInfo?.owner.toBase58());
            console.log("Expected program ID:", l1Program.programId.toBase58());
            console.log("MagicBlock program ID:", MAGICBLOCK_DELEGATION_PROGRAM_ID.toBase58());
            
            if (authStateAccountInfo) {
                const actualDisc = Array.from(authStateAccountInfo.data.slice(0, 8));
                console.log("UserAuthState data length:", authStateAccountInfo.data.length);
                console.log("UserAuthState first 16 bytes:", Array.from(authStateAccountInfo.data.slice(0, 16)));
                console.log("UserAuthState discriminator (first 8 bytes):", actualDisc);
                console.log("UserAuthState data hex (first 64 chars):", Buffer.from(authStateAccountInfo.data).toString('hex').slice(0, 64));
            }
            
            if (!profileAccountInfo) {
                setActionFeedbackMessage("❌ UserProfile not found! Please click 'Initialize Profile (1000 pts)' first.");
                setLoading(false);
                return;
            }

            if (!activeBetAccountInfo) {
                setActionFeedbackMessage("❌ ActiveBet PDA not found! Please click 'Initialize Profile (1000 pts)' first.");
                setLoading(false);
                return;
            }
            
            if (!authStateAccountInfo) {
                // UserAuthState doesn't exist - need to create profile first
                setActionFeedbackMessage("❌ UserAuthState not found! Please click 'Initialize Profile (1000 pts)' first.");
                console.error("UserAuthState PDA not found at:", userAuthStatePda.toBase58());
                setLoading(false);
                return;
            }
            // ========== END DEBUG ==========

            if (authStateAccountInfo) {
                // Account EXISTS. Check owner.
                if (authStateAccountInfo.owner.equals(MAGICBLOCK_DELEGATION_PROGRAM_ID)) {
                    // Already fully delegated to MagicBlock
                    setActionFeedbackMessage("Quick Bets are already enabled and managed by MagicBlock.");
                    // Ensure our client state reflects this if it's out of sync
                    if (!isDelegated) { // isDelegated is the React state based on authStateData
                        // Fetch raw data if needed to update local React state, or just assume.
                        // For simplicity, we'll just update the UI flag.
                        setAuthStateData({ ...(authStateData || {}), isDelegated: true });
                    }
                    setLoading(false);
                    return;
                } else if (authStateAccountInfo.owner.equals(l1Program.programId)) {
                    // Owned by OUR program. Try to decode OUR UserAuthState data.
                    let decodedData;
                    try {
                        // ❌ SAI: "UserAuthState" không tồn tại trong IDL
                        // decodedData = l1Program.coder.accounts.decode<any>("UserAuthState", authStateAccountInfo.data);

                        // ✅ ĐÚNG: tên account trong IDL là "userAuthState"
                        decodedData = l1Program.coder.accounts.decode<any>("userAuthState", authStateAccountInfo.data);
                    } catch (decodeError: any) {
                        console.error("❌ Failed to decode UserAuthState via IDL name 'userAuthState':", decodeError);
                        console.error("Account discriminator (actual, first 8 bytes):", Array.from(authStateAccountInfo.data.slice(0, 8)));
                        console.error("Expected discriminator (from Rust build):", [243, 187, 102, 170, 18, 136, 71, 213]);
                        console.error("Account address:", userAuthStatePda.toBase58());
                        console.error("Account owner:", authStateAccountInfo.owner.toBase58());
                        console.error("Program ID (client):", l1Program.programId.toBase58());
                        console.error("Data length:", authStateAccountInfo.data.length);
                        console.error("Data (hex, first 128 chars):", Buffer.from(authStateAccountInfo.data).toString('hex').slice(0, 128));
                        
                        setActionFeedbackMessage(
                            "❌ Internal error reading Quick Bets state. " +
                            "Please refresh the page, and if it still fails, try 'Initialize Profile' again."
                        );
                        setLoading(false);
                        return;
                    }
                    
                    const currentNonce = decodedData.nonce;
                    const alreadyBizDelegated = decodedData.isDelegated; // Our program's flag

                    if (alreadyBizDelegated) {
                        // Our program set is_delegated=true (manage_delegation step 1 done),
                        // but MB doesn't own it yet. This means delegate_auth_state (MB SDK call) needs to run.
                        setActionFeedbackMessage("Ready for MagicBlock SDK. Attempting MagicBlock delegation (Step 2)...");
                        await l1Program.methods.delegateAuthState()
                            .accounts({ payer: userAuthority, userAuthority: userAuthority, pda: userAuthStatePda } as any)
                            .rpc({ commitment: "confirmed" });
                        await l1Program.methods.delegateUserProfile()
                            .accounts({ payer: userAuthority, userAuthority: userAuthority, pda: userProfilePda } as any)
                            .rpc({ commitment: "confirmed" });
                        await l1Program.methods.delegateActiveBet()
                            .accounts({ payer: userAuthority, userAuthority: userAuthority, pda: activeBetPda } as any)
                            .rpc({ commitment: "confirmed" });
                        setActionFeedbackMessage("Successfully Enabled Quick Bets (MagicBlock SDK Confirmed)!");
                        // After this, owner has changed. fetchUserAuthStateData will fail.
                        // Optimistically update client state.
                        setAuthStateData({ ...decodedData, isDelegated: true }); // Keep existing data, update flag
                        setLoading(false);
                        return;
                    }
                    // If owned by us and not bizDelegated, proceed to full delegation flow below (sign message etc.)
                    setActionFeedbackMessage("Starting delegation process (Step 1: Sign Message)...");
                    // Fall through to sign message and call manageDelegation
                } else {
                    // Owned by some other unexpected program
                    setActionFeedbackMessage(`Error: Auth State PDA has an unexpected owner: ${authStateAccountInfo.owner.toBase58()}`);
                    setLoading(false); return;
                }
            }

            // If we are here, UserAuthState exists, is owned by us, and is_delegated is false.
            // We need to run manage_delegation (Step 1) then delegate_auth_state (Step 2).
            
            // Decode the current nonce from the account
            let decodedAuthState;
            try {
                // ❌ SAI:
                // decodedAuthState = l1Program.coder.accounts.decode<any>("UserAuthState", authStateAccountInfo.data);

                // ✅ ĐÚNG:
                decodedAuthState = l1Program.coder.accounts.decode<any>("userAuthState", authStateAccountInfo.data);
            } catch (decodeError: any) {
                console.error("❌ Failed to decode UserAuthState for nonce via IDL name 'userAuthState':", decodeError);
                console.error("Account discriminator (actual, first 8 bytes):", Array.from(authStateAccountInfo.data.slice(0, 8)));
                console.error("Expected discriminator (from Rust build):", [243, 187, 102, 170, 18, 136, 71, 213]);
                console.error("Account address:", userAuthStatePda.toBase58());
                console.error("Account owner:", authStateAccountInfo.owner.toBase58());
                console.error("Program ID (client):", l1Program.programId.toBase58());
                console.error("Data length:", authStateAccountInfo.data.length);
                console.error("Data (hex, first 128 chars):", Buffer.from(authStateAccountInfo.data).toString('hex').slice(0, 128));
                
                setActionFeedbackMessage(
                    "❌ Internal error reading Quick Bets state. " +
                    "Please refresh the page, and if it still fails, try 'Initialize Profile' again."
                );
                setLoading(false);
                return;
            }
            const currentNonceForSigning = decodedAuthState.nonce ? new BN(decodedAuthState.nonce.toString()) : new BN(0);

            const delegationMessageString = `BSBET_DELEGATE_AUTH:${userAuthority.toBase58()}:${currentNonceForSigning.toString()}`;

            setActionFeedbackMessage("Please Sign Message in Wallet (Step 1)...");

            // Use our utility function instead of calling wallet.signMessage directly
            const { signature: signatureForProgram, signatureBytes } =
                await signAndFormatMessage(userWallet, delegationMessageString);

            if (!signatureBytes || !signatureForProgram) {
                setActionFeedbackMessage("Message signing failed or was rejected");
                setLoading(false);
                return;
            }

            if (signatureForProgram.length !== 64) {
                setActionFeedbackMessage(`Invalid signature length: ${signatureForProgram.length}`);
                setLoading(false);
                return;
            }

            // Continue with the rest of the delegation process
            setActionFeedbackMessage("Processing On-chain Verification (Step 1)...");
            const messageBuffer = Buffer.from(delegationMessageString, 'utf8');

            await l1Program.methods.manageDelegation(1, messageBuffer, signatureForProgram as any)
                .accounts({
                    payer: userAuthority,
                    userAuthState: userAuthStatePda,
                    userAuthority: userAuthority,
                    systemProgram: SystemProgram.programId,
                    magicProgram: null, magicContext: null,
                    ixSysvar: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
                } as any).rpc({ commitment: "confirmed" });

            setActionFeedbackMessage("Confirming Delegation with MagicBlock (Step 2)...");
            const delegateTx = await l1Program.methods.delegateAuthState()
                .accounts({ payer: userAuthority, userAuthority: userAuthority, pda: userAuthStatePda } as any)
                .rpc({ commitment: "confirmed" });

            await l1Program.methods.delegateUserProfile()
                .accounts({ payer: userAuthority, userAuthority: userAuthority, pda: userProfilePda } as any)
                .rpc({ commitment: "confirmed" });

            await l1Program.methods.delegateActiveBet()
                .accounts({ payer: userAuthority, userAuthority: userAuthority, pda: activeBetPda } as any)
                .rpc({ commitment: "confirmed" });

            setActionFeedbackMessage(`Successfully Enabled Quick Bets! Tx: ${delegateTx}`);
            // After delegateAuthState, owner has changed.
            // Optimistically update client state to reflect delegation.
            // A "true" fetch would require getAccountInfo and manual decode of MB's data if any.
            setAuthStateData({
                userAuthority: userAuthority, // Assume this remains conceptually
                isDelegated: true,
                delegation_timestamp: new BN(Date.now() / 1000), // Approx
                nonce: currentNonceForSigning.add(new BN(1)), // Reflect nonce increment
                bump: authStateData?.bump || 0 // Try to preserve bump if known, else default
            });

        } catch (error: any) {
            console.error("Error Enabling Quick Bets:", error);
            let errorMsg = "Failed to enable Quick Bets: ";
            if (error instanceof anchor.AnchorError) {
                errorMsg += `(${error.error.errorCode.number}) ${error.error.errorMessage}`;
            } else { errorMsg += error.message || String(error); }
            setActionFeedbackMessage(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleUndelegate = async () => {
        if (!l1Program || !userAuthority || !userAuthStatePda) {
            setActionFeedbackMessage("Wallet/Program not ready for disabling Quick Bets.");
            setLoading(false);
            return;
        }

        if (!userProfilePda || !activeBetPda) {
            setActionFeedbackMessage("Profile/ActiveBet PDA not ready for disabling Quick Bets.");
            setLoading(false);
            return;
        }

        setLoading(true);

        try {
            console.log("\n=== DISABLE QUICK BETS DEBUG ===");
            console.log("User Authority (wallet):", userAuthority.toBase58());
            console.log("UserAuthState PDA:", userAuthStatePda.toBase58());
            console.log("UserProfile PDA:", userProfilePda?.toBase58());
            console.log("ActiveBet PDA:", activeBetPda?.toBase58());
            console.log("isDelegated (React state):", isDelegated);
            
            // 1) Lấy thông tin UserAuthState để biết owner hiện tại
            const authInfo = await l1Program.provider.connection.getAccountInfo(userAuthStatePda);
            if (!authInfo) {
                setActionFeedbackMessage("UserAuthState not found. Nothing to undelegate.");
                setLoading(false);
                return;
            }

            const owner = authInfo.owner.toBase58();
            const ourProgramId = l1Program.programId.toBase58();
            const magicProgramId = MAGICBLOCK_DELEGATION_PROGRAM_ID.toBase58();

            console.log("🔍 [handleUndelegate] UserAuthState owner:", owner);
            console.log("Our program ID:", ourProgramId);
            console.log("MagicBlock program ID:", magicProgramId);
            console.log("Owner == MagicBlock?", owner === magicProgramId);
            console.log("Owner == Our program?", owner === ourProgramId);

            // CASE 1: Owner vẫn là program của bạn → chỉ cần flip is_delegated = false
            if (owner === ourProgramId) {
                setActionFeedbackMessage("Disabling Quick Bets (updating on-chain flag)...");
                const undelegateTx = await l1Program.methods
                    .manageDelegation(0, Buffer.from([]), new Array(64).fill(0) as any)
                    .accounts({
                        userAuthState: userAuthStatePda,
                        userAuthority: userAuthority,
                        systemProgram: SystemProgram.programId,
                        ixSysvar: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
                    } as any)
                    .rpc({ commitment: "confirmed" });

                setActionFeedbackMessage(`Successfully Disabled Quick Bets! Tx: ${undelegateTx}`);
                await fetchUserAuthStateData();
                setLoading(false);
                return;
            }

            // CASE 2: Owner là MagicBlock program → cần config thêm để undelegate
            if (owner === magicProgramId) {
                if (!ephemeralProgram || !ephemeralProviderRef.current) {
                    setActionFeedbackMessage(
                        "Quick Bets is delegated, but MagicBlock provider/program is not ready for undelegation."
                    );
                    setLoading(false);
                    return;
                }

                // Make sure ALL PDAs are currently delegated (owned by delegation program)
                const [profileInfo, betInfo] = await Promise.all([
                    l1Program.provider.connection.getAccountInfo(userProfilePda),
                    l1Program.provider.connection.getAccountInfo(activeBetPda),
                ]);
                if (!profileInfo || !betInfo) {
                    setActionFeedbackMessage(
                        "Missing UserProfile/ActiveBet accounts; cannot safely undelegate."
                    );
                    setLoading(false);
                    return;
                }
                const profileOwner = profileInfo.owner.toBase58();
                const betOwner = betInfo.owner.toBase58();
                if (profileOwner !== magicProgramId || betOwner !== magicProgramId) {
                    setActionFeedbackMessage(
                        `Inconsistent delegation owners. auth=${owner}, profile=${profileOwner}, bet=${betOwner}. Cannot safely undelegate.`
                    );
                    setLoading(false);
                    return;
                }

                setActionFeedbackMessage("Disabling Quick Bets (undelegating from MagicBlock)...");

                const undelegateFromMbTx = await ephemeralProgram.methods
                    .undelegateFromMagicblock()
                    .accounts({
                        payer: userAuthority,
                        userAuthority: userAuthority,
                        userAuthStateToUndelegate: userAuthStatePda,
                        userProfileToUndelegate: userProfilePda,
                        activeBetToUndelegate: activeBetPda,
                        magicProgram: MAGICBLOCK_MAGIC_PROGRAM_ID,
                        magicContext: MAGICBLOCK_MAGIC_CONTEXT,
                    } as any)
                    .rpc({ commitment: "confirmed" });

                console.log("✅ Undelegated from MagicBlock tx:", undelegateFromMbTx);

                // After ownership is returned, flip our local on-chain flag on L1.
                const flipTx = await l1Program.methods
                    .manageDelegation(0, Buffer.from([]), new Array(64).fill(0) as any)
                    .accounts({
                        userAuthState: userAuthStatePda,
                        userAuthority: userAuthority,
                        systemProgram: SystemProgram.programId,
                        ixSysvar: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
                    } as any)
                    .rpc({ commitment: "confirmed" });

                setActionFeedbackMessage(
                    `Successfully Disabled Quick Bets! UndelegateTx: ${undelegateFromMbTx}, FlagTx: ${flipTx}`
                );
                await fetchUserAuthStateData();
                setLoading(false);
                return;
            }

            // CASE 3: Owner lạ
            setActionFeedbackMessage(`Unexpected owner for UserAuthState: ${owner}. Cannot safely undelegate.`);
        } catch (error: any) {
            console.error("Error Disabling Quick Bets:", error);
            let errorMsg = "Failed to disable Quick Bets: ";
            if (error instanceof anchor.AnchorError) {
                errorMsg += `(${error.error.errorCode.number}) ${error.error.errorMessage}`;
            } else {
                errorMsg += error.message || String(error);
            }
            setActionFeedbackMessage(errorMsg);
            await fetchUserAuthStateData();
        } finally {
            setLoading(false);
        }
    };

    // --- MODIFIED: Handle Bet Placement ---
    const handleBet = async (direction: "UP" | "DOWN") => { // Parameter is 'direction'
        // Spec: QuickBet OFF => normal bet, QuickBet ON => ephemeral bet
        const useQuickBets = !!isDelegated;

        if (!l1Program || !userAuthority || !userProfilePda || !userAuthStatePda || !activeBetPda || !l1Provider) {
            setActionFeedbackMessage('Wallet/Program not ready for bet.');
            return;
        }
        if (useQuickBets && (!ephemeralProgram || !ephemeralProviderRef.current)) {
            setActionFeedbackMessage('Quick Bets enabled but MagicBlock provider/program not ready.');
            return;
        }
        if (isProfileInitialized && userPoints < fixedBetAmount) {
            setActionFeedbackMessage('Insufficient points.'); return;
        }
        setLoading(true); setActionFeedbackMessage(`Placing ${direction} bet...`); setFeedback(null);

        // This is where directionArg is defined based on the 'direction' parameter
        const directionArg: number = direction === "UP" ? 1 : 0;
        const assetNameArg: string = "SOL/USD";
        const amountArg = new BN(fixedBetAmount);
        const durationSecondsArg = new BN(1 * 60); // 1 minute for testing

        try {
            console.log("\n=== PLACE BET DEBUG ===");
            console.log(`Direction: ${direction} (${directionArg})`);
            console.log(`Amount: ${fixedBetAmount} points`);
            console.log(`Duration: 1 minute`);
            console.log("User Authority (wallet):", userAuthority.toBase58());
            console.log("UserProfile PDA:", userProfilePda.toBase58());
            console.log("UserAuthState PDA:", userAuthStatePda.toBase58());
            console.log("ActiveBet PDA:", activeBetPda.toBase58());
            console.log("isDelegated (React state):", isDelegated);
            console.log("useQuickBets?", useQuickBets);

            let txSignature: string;

            if (!useQuickBets) {
                txSignature = await l1Program.methods
                    .openBetNormal(assetNameArg, directionArg, amountArg, durationSecondsArg)
                    .accounts({
                        userSigner: userAuthority,
                        userAuthState: userAuthStatePda,
                        userProfile: userProfilePda,
                        activeBet: activeBetPda,
                        pythPriceFeed: PYTH_SOL_USD_PRICE_ACCOUNT,
                        systemProgram: SystemProgram.programId,
                    } as any)
                    .rpc({ commitment: "confirmed" });
            } else {
                const authInfo = await l1Program.provider.connection.getAccountInfo(userAuthStatePda);
                const profileInfo = await l1Program.provider.connection.getAccountInfo(userProfilePda);
                const betInfo = await l1Program.provider.connection.getAccountInfo(activeBetPda);

                if (
                    !authInfo || !profileInfo || !betInfo ||
                    !authInfo.owner.equals(MAGICBLOCK_DELEGATION_PROGRAM_ID) ||
                    !profileInfo.owner.equals(MAGICBLOCK_DELEGATION_PROGRAM_ID) ||
                    !betInfo.owner.equals(MAGICBLOCK_DELEGATION_PROGRAM_ID)
                ) {
                    setActionFeedbackMessage(
                        "Quick Bets is ON, but not all PDAs are delegated. Click 'Enable Quick Bets' again to delegate auth/profile/active_bet."
                    );
                    return;
                }

                txSignature = await ephemeralProgram!.methods
                    .openBetEphemeral(assetNameArg, directionArg, amountArg, durationSecondsArg, userAuthority)
                    .accounts({
                        payer: userAuthority,
                        userAuthState: userAuthStatePda,
                        userProfile: userProfilePda,
                        activeBet: activeBetPda,
                        pythPriceFeed: PYTH_SOL_USD_PRICE_ACCOUNT,
                        magicProgram: MAGICBLOCK_MAGIC_PROGRAM_ID,
                        magicContext: MAGICBLOCK_MAGIC_CONTEXT,
                    } as any)
                    .rpc({ commitment: "confirmed" });
            }

            setFeedback(`Bet ${direction} Placed!`);
            setActionFeedbackMessage(`Tx: ${txSignature} via ${useQuickBets ? "MB" : "L1"}`);
            await fetchUserProfileData();
            await fetchAndDisplayActiveBets();


        } catch (error: any) {
            const msg = error?.message || String(error);
            const rejected =
                msg.includes("User rejected") ||
                msg.includes("rejected the request") ||
                msg.includes("Transaction cancelled") ||
                error?.name === "WalletSignTransactionError";

            if (rejected) {
                console.warn("Bet cancelled by user.");
                setFeedback(null);
                setActionFeedbackMessage("Transaction cancelled.");
                return;
            }

            console.error("Error opening bet:", error);
            let errorMsg = "Failed to place bet.";
            if (error instanceof anchor.AnchorError) {
                errorMsg = `Bet Error (${error.error.errorCode.number}): ${error.error.errorMessage}`;
                if (error.error.errorCode.number === 6015) {
                    errorMsg += " Try enabling Quick Bets or ensure profile is active.";
                }
            } else if (msg) {
                errorMsg += ` ${msg}`;
            }
            setFeedback(null); setActionFeedbackMessage(errorMsg);
            await fetchUserProfileData(); // Refresh points
        }
        finally { setLoading(false); }
    };

    return (
        <div className="bg-gray-900 p-6 rounded-lg shadow-lg w-full max-w-xs flex flex-col items-center justify-between h-full min-h-[350px]">
            <div className="w-full flex flex-col items-center mb-4">
                <UserProfile userPoints={userPoints} fixedBetAmount={fixedBetAmount} isProfileInitialized={isProfileInitialized} />
            </div>

            {/* --- MODIFIED: Separate Buttons for Enable/Disable Delegation --- */}
            {userWallet && userAuthority && authStateData !== undefined && ( // Show if auth state is loaded or explicitly null after fetch
                <div className="my-3 w-full">
                    {!isDelegated ? (
                        // Show "Enable Quick Bets" button if not currently delegated
                        <button
                            className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-500 transition-colors text-sm disabled:bg-gray-600 disabled:cursor-not-allowed"
                            onClick={handleDelegate}
                            disabled={loading || !userWallet?.signMessage || !l1Program || !connected || !isProfileInitialized}
                        >
                            {loading && actionFeedbackMessage.includes("Enabling") ? "Enabling Quick Bets..." : "Enable Quick Bets"}
                        </button>
                    ) : (
                        // Show "Disable Quick Bets" button if currently delegated
                        <button
                            className="w-full px-4 py-2.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-500 transition-colors text-sm"
                            onClick={handleUndelegate}
                            disabled={loading || !l1Program || !connected}
                        >
                            {loading && actionFeedbackMessage.includes("Disabling") ? "Disabling Quick Bets..." : "Disable Quick Bets"}
                        </button>
                    )}
                    <p className="text-xs text-gray-400 mt-1 text-center">
                        {!isProfileInitialized 
                            ? "Initialize profile first to enable Quick Bets" 
                            : isDelegated 
                                ? "Quick Bets: ON (MagicBlock Active)" 
                                : "Quick Bets: OFF (Standard Transactions)"}
                    </p>
                </div>
            )}
            {userWallet && userAuthority && authStateData === undefined && ( // Still loading initial auth state
                <div className="my-3 w-full">
                    <button className="w-full px-4 py-2.5 bg-gray-500 text-white rounded-lg font-semibold text-sm" disabled>
                        Loading Quick Bet Status...
                    </button>
                </div>
            )}
            {/* --- END MODIFIED Buttons --- */}


            {/* Bet Buttons */}
            <div className="flex flex-col gap-6 w-full flex-1 justify-center items-center">
                <button
                    className="w-full py-6 text-2xl font-bold rounded-lg bg-green-900 hover:bg-green-800 transition text-white shadow-lg mb-2"
                    style={{ minHeight: 124 }}
                    disabled={loading || !userWallet || !connected || (isProfileInitialized && userPoints < fixedBetAmount)}
                    onClick={() => handleBet("UP")}
                > <span className="mr-2">⬆️</span> UP </button>
                <button
                    className="w-full py-6 text-2xl font-bold rounded-lg bg-red-900 hover:bg-red-800 transition text-white shadow-lg"
                    style={{ minHeight: 124 }}
                    disabled={loading || !userWallet || !connected || (isProfileInitialized && userPoints < fixedBetAmount)}
                    onClick={() => handleBet("DOWN")}
                > <span className="mr-2">⬇️</span> DOWN </button>
            </div>

            {/* Feedback Area */}
            <div className="mt-4 h-6 text-center w-full">
                {loading && !feedback && <span className="text-blue-400">Processing...</span>}
                {feedback && <span className="text-green-400 font-semibold">{feedback}</span>}
                {!loading && userWallet && isProfileInitialized && userPoints < fixedBetAmount && !feedback && (
                    <span className="text-red-400">Insufficient points</span>
                )}
            </div>
            <div className="mt-1 text-xs text-gray-400 w-full text-center min-h-[2em]">
                {typeof actionFeedbackMessage === 'string'
                    ? formatActionFeedbackMessage(actionFeedbackMessage)
                    : actionFeedbackMessage}
            </div>

            {/* Initialize Profile Button */}
            {userWallet && !isProfileInitialized && userAuthority && (
                <div className="mt-3 w-full">
                    <button
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-500 transition-colors text-sm"
                        onClick={handleCreateUserProfile}
                        disabled={loading || !l1Program || !userProfilePda || !userAuthStatePda || !connected}
                    >
                        {loading && actionFeedbackMessage.includes("profile") ? "Initializing..." : "Initialize Profile (1000 pts)"}
                    </button>
                </div>
            )}

            {/* Add right before the closing div of the main container */}
            <div className="w-full text-center mt-2 text-xs text-gray-500">
                {!connected && <span className="text-yellow-500">Wallet not connected. Please connect to place bets.</span>}
                {connected && !userWallet?.signMessage && <span className="text-yellow-500">Connected wallet does not support signing. Features may be limited.</span>}
            </div>
        </div>
    );
}