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

export type ClientActiveBet = {
    user: PublicKey;
    assetName: string;
    initialPrice: number;
    expiryTimestamp: number;
    direction: number;
    amountStaked: number;
    resolvedPrice: number;
    status: number;
    bump: number;
};

// Read constants from environment variables
const PYTH_SOL_USD_PRICE_ACCOUNT = new anchor.web3.PublicKey(
    process.env.NEXT_PUBLIC_PYTH_SOL_USD_PRICE_ACCOUNT || "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE"
);
const PROGRAM_ID = new anchor.web3.PublicKey(
    process.env.NEXT_PUBLIC_BSBET_PROGRAM_ID || "3awHJrzJbNCCLcQNEdh5mcVfPZW55w5v7tQhDwkx7Hpt"
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
                    href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
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
    const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null);
    const [authStateData, setAuthStateData] = useState<Record<string, unknown> | null>(null);
    const [displayableBets, setDisplayableBets] = useState<DisplayableActiveBet[]>([]);

    const userPoints = profileData ? Number(profileData.points) : 0; // Don't show 1000 until profile is actually created
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
                setActionFeedbackMessage('PDAs derived.');
            } catch (error) {
                console.error("Error deriving PDAs:", error);
            }
        } else { /* ... clear PDAs ... */ }
    }, [l1Program, userAuthority, userWallet]);

    // Fetch functions use L1 program to get ground truth state
    const fetchUserProfileData = useCallback(async () => {
        if (!l1Program || !userProfilePda) return;
        try {
            const data = await l1Program.account.userProfile.fetch(userProfilePda);
            setProfileData(data);
        }
        catch (e) {
            setProfileData(null);
            console.warn("Fetch profile L1 error", e);
        }
    }, [l1Program, userProfilePda]);

    const fetchUserAuthStateData = useCallback(async () => {
        if (!l1Program || !userAuthStatePda) return;
        try {
            const data = await l1Program.account.userAuthState.fetch(userAuthStatePda);
            setAuthStateData(data);
        }
        catch (e) {
            setAuthStateData(null);
            console.warn("Fetch auth L1 error", e);
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
        if (!l1Program || !userAuthority || !userProfilePda || !userAuthStatePda) return;
        setLoading(true);
        setActionFeedbackMessage("Creating profile...");
        try {
            console.group("[bs_bet] createUserProfile");
            console.log("userAuthority:", userAuthority.toBase58());
            console.log("userProfilePda:", userProfilePda.toBase58());
            console.log("userAuthStatePda:", userAuthStatePda.toBase58());
            console.log("programId:", l1Program.programId.toBase58());
            const tx = await l1Program.methods.createUserProfile().accounts({
                userProfile: userProfilePda,
                userAuthStateForProfileCreation: userAuthStatePda,
                userAuthority: userAuthority,
                systemProgram: SystemProgram.programId,
            } as any).rpc({ commitment: "confirmed" });
            console.log("tx:", tx);
            setActionFeedbackMessage(`Profile initialized! Tx: ${tx}`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            await fetchUserProfileData();
            await fetchUserAuthStateData();
        } catch (err: any) {
            console.error("Error creating user profile:", err);
            if (err.message?.includes("already in use") || err.message?.includes("custom program error: 0x0")) {
                setActionFeedbackMessage("Profile already exists! Refreshing data...");
                await fetchUserProfileData();
                await fetchUserAuthStateData();
            } else {
                setActionFeedbackMessage(`Failed: ${err.message || String(err)}`);
            }
        } finally {
            console.groupEnd();
            setLoading(false);
        }
    }, [l1Program, userAuthority, userProfilePda, userAuthStatePda, fetchUserProfileData, fetchUserAuthStateData]);

    const fetchAndDisplayActiveBets = useCallback(async () => {
        if (!l1Program || !userAuthority) {
            setDisplayableBets([]);
            return;
        }
        try {
            const storedBetKeys = JSON.parse(
                localStorage.getItem(`activeBets_${userAuthority.toBase58()}`) || '[]'
            );
            const bets: DisplayableActiveBet[] = [];
            for (const keyStr of storedBetKeys) {
                try {
                    const betPubkey = new PublicKey(keyStr);
                    const betData = await l1Program.account.activeBet.fetch(betPubkey);
                    bets.push({
                        user: betData.user,
                        assetName: betData.assetName,
                        initialPrice: Number(betData.initialPrice),
                        expiryTimestamp: Number(betData.expiryTimestamp),
                        direction: betData.direction,
                        amountStaked: Number(betData.amountStaked),
                        resolvedPrice: Number(betData.resolvedPrice),
                        status: betData.status,
                        bump: (betData as any).bump || 0,
                        publicKey: keyStr,
                    } as DisplayableActiveBet);
                } catch (e) {
                    console.warn(`Failed to fetch bet ${keyStr}:`, e);
                }
            }
            setDisplayableBets(bets);
        } catch (e) {
            console.warn('Error fetching active bets:', e);
            setDisplayableBets([]);
        }
    }, [l1Program, userAuthority]);

    useEffect(() => { if (l1Program && userAuthority) fetchAndDisplayActiveBets(); }, [l1Program, userAuthority, fetchAndDisplayActiveBets]);

    // MagicBlock Delegation Program ID
    const MAGICBLOCK_DELEGATION_PROGRAM_ID = new anchor.web3.PublicKey(
        process.env.NEXT_PUBLIC_MAGICBLOCK_DELEGATION_PROGRAM_ID || "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
    );

    const checkUserAuthState = useCallback(async () => {
        if (!l1Program || !userAuthStatePda) return;
        try {
            const info = await l1Program.provider.connection.getAccountInfo(userAuthStatePda);
            console.log("=== UserAuthState Debug Info ===");
            console.log("PDA Address:", userAuthStatePda.toBase58());
            if (!info) {
                console.log("❌ Account does NOT exist");
                return null;
            }
            console.log("✅ Account exists");
            console.log("Owner:", info.owner.toBase58());
            console.log("Data length:", info.data.length);
            console.log("Discriminator (first 8 bytes):", Array.from(info.data.slice(0, 8)));
            try {
                const decoded = l1Program.coder.accounts.decode<any>("userAuthState", info.data);
                console.log("Decoded data:", decoded);
                return decoded;
            } catch (e) {
                console.error("Failed to decode:", e);
                return null;
            }
        } catch (e) {
            console.error("Error checking UserAuthState:", e);
            return null;
        }
    }, [l1Program, userAuthStatePda]);

    const handleDelegate = async () => {
        if (!l1Program || !userAuthority || !userAuthStatePda || !userWallet?.signMessage) {
            setActionFeedbackMessage("Wallet/Program not ready for delegation.");
            setLoading(false); return;
        }

        setLoading(true);
        setActionFeedbackMessage("Checking current delegation status...");
        
        // Debug: Check UserAuthState
        await checkUserAuthState();

        try {
            console.group("[bs_bet] Enable Quick Bets (delegate)");
            console.log("programId:", l1Program.programId.toBase58());
            console.log("userAuthority:", userAuthority.toBase58());
            console.log("userAuthStatePda:", userAuthStatePda.toBase58());
            try {
                const [derived] = anchor.web3.PublicKey.findProgramAddressSync(
                    [Buffer.from("auth_state"), userAuthority.toBuffer()],
                    l1Program.programId
                );
                console.log("derivedUserAuthStatePda:", derived.toBase58(), "match?", derived.equals(userAuthStatePda));
            } catch (e) {
                console.warn("Failed to derive PDA for debug:", e);
            }

            const authStateAccountInfo = await l1Program.provider.connection.getAccountInfo(userAuthStatePda);
            console.log("L1 getAccountInfo(owner):", authStateAccountInfo?.owner?.toBase58() ?? "<null>");

            if (!authStateAccountInfo) {
                setActionFeedbackMessage(
                    "❌ UserAuthState not found! Please click 'Initialize Profile (1000 pts)' first to create all required accounts."
                );
                console.error("UserAuthState PDA not found at:", userAuthStatePda.toBase58());
                setLoading(false);
                return;
            }

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
                    console.log("Already delegated: owner is MagicBlock delegation program");
                    console.groupEnd();
                    return;
                } else if (authStateAccountInfo.owner.equals(l1Program.programId)) {
                    // Owned by OUR program. Try to decode OUR UserAuthState data.
                    const decodedData = l1Program.coder.accounts.decode<any>("userAuthState", authStateAccountInfo.data);
                    const currentNonce = decodedData.nonce;
                    const alreadyBizDelegated = decodedData.isDelegated; // Our program's flag

                    console.log("decoded.isDelegated:", alreadyBizDelegated);
                    console.log("decoded.nonce:", currentNonce?.toString?.() ?? String(currentNonce));

                    if (alreadyBizDelegated) {
                        // Our program set is_delegated=true (manage_delegation step 1 done),
                        // but MB doesn't own it yet. This means delegate_auth_state (MB SDK call) needs to run.
                        setActionFeedbackMessage("Ready for MagicBlock SDK. Attempting MagicBlock delegation (Step 2)...");
                        await l1Program.methods.delegateAuthState()
                            .accounts({ payer: userAuthority, pda: userAuthStatePda } as any)
                            .rpc({ commitment: "confirmed" });

                        const postDelegateInfo = await l1Program.provider.connection.getAccountInfo(userAuthStatePda);
                        console.log("post-delegate owner:", postDelegateInfo?.owner?.toBase58() ?? "<null>");
                        setActionFeedbackMessage("Successfully Enabled Quick Bets (MagicBlock SDK Confirmed)!");
                        // After this, owner has changed. fetchUserAuthStateData will fail.
                        // Optimistically update client state.
                        setAuthStateData({ ...decodedData, isDelegated: true }); // Keep existing data, update flag
                        setLoading(false);
                        console.groupEnd();
                        return;
                    }
                    // If owned by us and not bizDelegated, proceed to full delegation flow below (sign message etc.)
                    setActionFeedbackMessage("Starting delegation process (Step 1: Sign Message)...");
                    // Fall through to sign message and call manageDelegation
                } else {
                    // Owned by some other unexpected program
                    setActionFeedbackMessage(`Error: Auth State PDA has an unexpected owner: ${authStateAccountInfo.owner.toBase58()}`);
                    setLoading(false);
                    console.groupEnd();
                    return;
                }
            } else {
                // UserAuthState PDA does not exist, will be created by manage_delegation
                setActionFeedbackMessage("New user for delegation. Starting process (Step 1: Sign Message)...");
                // Fall through to sign message and call manageDelegation (currentNonce will be new BN(0))
            }

            // If we are here, UserAuthState either doesn't exist or is owned by us and is_delegated is false.
            // We need to run manage_delegation (Step 1) then delegate_auth_state (Step 2).
            let currentNonceForSigning = new BN(0);
            if (authStateData && authStateAccountInfo && authStateAccountInfo.owner.equals(l1Program.programId)) {
                // If we successfully decoded our data above and it's not delegated yet
                const nonceValue = (authStateData as any).nonce;
                currentNonceForSigning = nonceValue ? new BN(nonceValue.toString()) : new BN(0);
            }

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
                    userAuthState: userAuthStatePda,
                    userAuthority: userAuthority,
                    systemProgram: SystemProgram.programId,
                    magicProgram: null, magicContext: null,
                    ixSysvar: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
                } as any).rpc({ commitment: "confirmed" });

            const postManageInfo = await l1Program.provider.connection.getAccountInfo(userAuthStatePda);
            console.log("post-manageDelegation owner:", postManageInfo?.owner?.toBase58() ?? "<null>");
            if (postManageInfo?.data) {
                try {
                    const decoded = l1Program.coder.accounts.decode<any>("userAuthState", postManageInfo.data);
                    console.log("post-manageDelegation decoded:", decoded);
                } catch (e) {
                    console.warn("post-manageDelegation decode failed:", e);
                }
            }

            setActionFeedbackMessage("Confirming Delegation with MagicBlock (Step 2)...");
            const delegateTx = await l1Program.methods.delegateAuthState()
                .accounts({ payer: userAuthority, pda: userAuthStatePda } as any)
                .rpc({ commitment: "confirmed" });

            const postDelegateInfo2 = await l1Program.provider.connection.getAccountInfo(userAuthStatePda);
            console.log("post-delegateAuthState owner:", postDelegateInfo2?.owner?.toBase58() ?? "<null>");

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
            if (error?.logs) console.error("Anchor logs:", error.logs);
            let errorMsg = "Failed to enable Quick Bets: ";
            if (error instanceof anchor.AnchorError) {
                errorMsg += `(${error.error.errorCode.number}) ${error.error.errorMessage}`;
            } else { errorMsg += error.message || String(error); }
            setActionFeedbackMessage(errorMsg);
        } finally {
            console.groupEnd();
            setLoading(false);
        }
    };

    const handleUndelegate = async () => {
        if (!l1Program || !userAuthority || !userAuthStatePda || !userWallet?.signTransaction) {
            setActionFeedbackMessage("Wallet/Program not ready for disabling Quick Bets."); setLoading(false); return;
        }

        setLoading(true); setActionFeedbackMessage("Disabling Quick Bets (Step 1: Telling MagicBlock)...");
        try {
            console.group("[bs_bet] Disable Quick Bets (undelegate)");
            console.log("programId:", l1Program.programId.toBase58());
            console.log("userAuthority:", userAuthority.toBase58());
            console.log("userAuthStatePda:", userAuthStatePda.toBase58());
            const preInfo = await l1Program.provider.connection.getAccountInfo(userAuthStatePda, "confirmed");
            console.log("pre-undelegate L1 owner:", preInfo?.owner?.toBase58() ?? "<null>");

            // If ownership is already back on L1, we can directly finalize state.
            if (preInfo?.owner && preInfo.owner.equals(l1Program.programId)) {
                setActionFeedbackMessage("Ownership already on L1. Finalizing state (Step 2)...");
                const undelegateTx = await l1Program.methods.manageDelegation(0, Buffer.from([]), new Array(64).fill(0) as any)
                    .accounts({
                        userAuthState: userAuthStatePda,
                        userAuthority: userAuthority,
                        systemProgram: SystemProgram.programId,
                        ixSysvar: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
                        magicProgram: null,
                        magicContext: null,
                    } as any)
                    .rpc({ commitment: "confirmed" });

                setActionFeedbackMessage(`Successfully Disabled Quick Bets! Tx: ${undelegateTx}`);
                await fetchUserAuthStateData();
                return;
            }

            // MagicBlock template pattern: build TX, sign once, sendRawTransaction via MagicBlock RPC
            const magicblockConnection = new SolanaConnection(MAGICBLOCK_RPC_ENDPOINT, "confirmed");

            const tx = await l1Program.methods
                .undelegateFromMagicblock()
                .accounts({
                    userAuthority: userAuthority,
                    userAuthStateToUndelegate: userAuthStatePda,
                } as any)
                .transaction();

            const {
                context: { slot: minContextSlot },
                value: { blockhash, lastValidBlockHeight },
            } = await magicblockConnection.getLatestBlockhashAndContext();

            tx.feePayer = userAuthority;
            tx.recentBlockhash = blockhash;

            const signed = await userWallet.signTransaction(tx);
            const sig1 = await magicblockConnection.sendRawTransaction(signed.serialize(), {
                skipPreflight: true,
                minContextSlot,
            });

            await magicblockConnection.confirmTransaction(
                { signature: sig1, blockhash, lastValidBlockHeight },
                "confirmed"
            );

            console.log("undelegate tx sig:", sig1);
            try {
                const txDetails = await magicblockConnection.getTransaction(sig1, {
                    commitment: "confirmed",
                    maxSupportedTransactionVersion: 0,
                } as any);
                const logs = txDetails?.meta?.logMessages;
                if (logs?.length) console.log("MagicBlock tx logMessages:", logs);
            } catch (e) {
                console.warn("Unable to fetch MagicBlock tx logs:", e);
            }

            setActionFeedbackMessage(`MagicBlock undelegation initiated (Step 1 complete). Tx: ${sig1}. Waiting for L1 ownership...`);

            // IMPORTANT: the PDA may stay owned by MagicBlock briefly even after the tx is confirmed.
            // If we call manageDelegation(0) too early, Anchor will fail with AccountOwnedByWrongProgram.
            const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
            // MagicBlock undelegation is scheduled; ownership return can take a bit.
            // Instead of failing and requiring a 2nd click, just wait longer and show progress.
            let ownerReturned = false;
            const maxAttempts = 90; // ~45s
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                const info = await l1Program.provider.connection.getAccountInfo(userAuthStatePda, "confirmed");
                const owner = info?.owner;
                console.log(`poll[${attempt}] L1 owner:`, owner?.toBase58() ?? "<null>");
                if (owner && owner.equals(l1Program.programId)) {
                    ownerReturned = true;
                    break;
                }
                if (attempt === 10 || attempt === 30 || attempt === 60) {
                    setActionFeedbackMessage(
                        `Undelegation scheduled. Waiting for ownership to return... (${attempt}/${maxAttempts})`
                    );
                }
                await sleep(500);
            }
            if (!ownerReturned) {
                setActionFeedbackMessage(
                    "Undelegation is still pending on MagicBlock. Please wait ~30-60s and try again if it doesn't complete."
                );
                return;
            }

            setActionFeedbackMessage("Ownership returned. Finalizing state (Step 2)...");

            // Step 2: Now that ownership is (hopefully) back with our program,
            // call manageDelegation(0) to update our UserAuthState.is_delegated flag.
            const undelegateTx = await l1Program.methods.manageDelegation(0, Buffer.from([]), new Array(64).fill(0) as any)
                .accounts({
                    userAuthState: userAuthStatePda,
                    userAuthority: userAuthority,
                    systemProgram: SystemProgram.programId,
                    ixSysvar: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
                    magicProgram: null,
                    magicContext: null,
                } as any)
                .rpc({ commitment: "confirmed" });

            const postInfo = await l1Program.provider.connection.getAccountInfo(userAuthStatePda, "confirmed");
            console.log("post-manageDelegation(0) owner:", postInfo?.owner?.toBase58() ?? "<null>");
            if (postInfo?.data) {
                try {
                    const decoded = l1Program.coder.accounts.decode<any>("userAuthState", postInfo.data);
                    console.log("post-manageDelegation(0) decoded:", decoded);
                } catch (e) {
                    console.warn("post-manageDelegation(0) decode failed:", e);
                }
            }

            setActionFeedbackMessage(`Successfully Disabled Quick Bets! Tx: ${undelegateTx}`);
            await fetchUserAuthStateData(); // This should now fetch Account<UserAuthState> with is_delegated = false

        } catch (error: any) {
            console.error("Error Disabling Quick Bets:", error);
            if (error?.logs) console.error("Anchor logs:", error.logs);
            let errorMsg = "Failed to disable Quick Bets: ";
            // ... (your existing error parsing) ...
            if (error instanceof anchor.AnchorError) { errorMsg += `(${error.error.errorCode.number}) ${error.error.errorMessage}`; }
            else { errorMsg += error.message || String(error); }
            setActionFeedbackMessage(errorMsg);
            await fetchUserAuthStateData(); // Fetch to see what state it's in
        } finally {
            console.groupEnd();
            setLoading(false);
        }
    };

    // --- MODIFIED: Handle Bet Placement ---
    const handleBet = async (direction: "UP" | "DOWN") => { // Parameter is 'direction'
        // Determine which program client and provider to use
        const currentProgram = isDelegated && ephemeralProgram ? ephemeralProgram : l1Program;
        const currentProvider = isDelegated && ephemeralProviderRef.current ? ephemeralProviderRef.current : l1Provider;

        if (!currentProgram || !userAuthority || !userProfilePda || !userAuthStatePda || !currentProvider) {
            setActionFeedbackMessage('Wallet/Program not ready for bet.'); return;
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
        const betAccountKeypair = Keypair.generate();

        try {
            console.group(`[bs_bet] openBet (${direction})`);
            console.log(`mode: ${isDelegated && ephemeralProgram ? "MagicBlock (ephemeral RPC)" : "L1"}`);
            console.log("userAuthority:", userAuthority.toBase58());
            console.log("userProfilePda:", userProfilePda.toBase58());
            console.log("userAuthStatePda:", userAuthStatePda.toBase58());
            // Owner check should use the L1 connection (ground truth). Guard in case l1Program is not available.
            if (l1Program) {
                const info = await l1Program.provider.connection.getAccountInfo(userAuthStatePda, "confirmed");
                console.log("UserAuthState owner (L1 view):", info?.owner?.toBase58() ?? "<null>");
            } else {
                console.log("UserAuthState owner (L1 view): <skipped - l1Program not ready>");
            }

            const methodsBuilder = currentProgram.methods
                .openBet( // Call to the Rust program's open_bet instruction
                    assetNameArg,
                    directionArg, // --- THIS IS THE CORRECTED VARIABLE ---
                    amountArg,
                    durationSecondsArg,
                    userAuthority // user_authority_for_pdas
                )
                .accounts({
                    betAccount: betAccountKeypair.publicKey,
                    userSigner: userAuthority,
                    userAuthState: userAuthStatePda,
                    userProfile: userProfilePda,
                    pythPriceFeed: PYTH_SOL_USD_PRICE_ACCOUNT,
                    systemProgram: SystemProgram.programId,
                } as any)
                .signers([betAccountKeypair]);

            let txSignature: string;
            if (isDelegated && ephemeralProviderRef.current && currentProgram === ephemeralProgram) {
                console.log("Sending TX via Ephemeral Provider's RPC method");
                txSignature = await methodsBuilder.rpc({ commitment: "confirmed" });
            } else {
                console.log("Sending TX via L1 Provider's RPC method");
                txSignature = await methodsBuilder.rpc({ commitment: "confirmed" });
            }

            console.log("openBet tx:", txSignature);

            setFeedback(`Bet ${direction} Placed!`);
            setActionFeedbackMessage(`Tx: ${txSignature} via ${isDelegated && ephemeralProgram ? "MB" : "L1"}`);
            // ... (localStorage, fetchUserProfileData, fetchAndDisplayActiveBets using l1Program) ...
            const currentBets = JSON.parse(localStorage.getItem(`activeBets_${userAuthority.toBase58()}`) || '[]');
            localStorage.setItem(`activeBets_${userAuthority.toBase58()}`, JSON.stringify([...currentBets, betAccountKeypair.publicKey.toBase58()]));
            await fetchUserProfileData(); // Assuming this uses l1Program to get ground truth
            await fetchAndDisplayActiveBets(); // Assuming this uses l1Program


        } catch (error: any) {
            console.error("Error opening bet:", error);
            if (error?.logs) console.error("Anchor logs:", error.logs);
            let errorMsg = "Failed to place bet.";
            if (error instanceof anchor.AnchorError) {
                errorMsg = `Bet Error (${error.error.errorCode.number}): ${error.error.errorMessage}`;
                if (error.error.errorCode.number === 6015) {
                    errorMsg += " Try enabling Quick Bets or ensure profile is active.";
                }
            } else if (error.message) { errorMsg += ` ${error.message}`; }
            setFeedback(null); setActionFeedbackMessage(errorMsg);
            await fetchUserProfileData(); // Refresh points
        }
        finally {
            console.groupEnd();
            setLoading(false);
        }
    };

    return (
        <div className="bg-gray-900 p-6 rounded-lg shadow-lg w-full max-w-xs flex flex-col items-center justify-between h-full min-h-[350px]">
            <div className="w-full flex flex-col items-center mb-4">
                <UserProfile userPoints={userPoints} fixedBetAmount={fixedBetAmount} isProfileInitialized={isProfileInitialized} />
            </div>

            {/* Debug: Check UserAuthState */}
            {userWallet && userAuthority && userAuthStatePda && (
                <div className="my-2 w-full">
                    <button
                        className="w-full px-2 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600"
                        onClick={checkUserAuthState}
                        disabled={loading}
                    >
                        🔍 Debug: Check UserAuthState (Console)
                    </button>
                </div>
            )}

            {/* --- MODIFIED: Separate Buttons for Enable/Disable Delegation --- */}
            {userWallet && userAuthority && authStateData !== undefined && ( // Show if auth state is loaded or explicitly null after fetch
                <div className="my-3 w-full">
                    {!isDelegated ? (
                        // Show "Enable Quick Bets" button if not currently delegated
                        <button
                            className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-500 transition-colors text-sm"
                            onClick={handleDelegate}
                            disabled={loading || !userWallet?.signMessage || !l1Program || !connected}
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
                        {isDelegated ? "Quick Bets: ON (MagicBlock Active)" : "Quick Bets: OFF (Standard Transactions)"}
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

            {/* Active Bets Display */}
            {displayableBets.length > 0 && (
                <div className="mt-4 w-full">
                    <h3 className="text-sm font-semibold text-gray-300 mb-2">Active Bets</h3>
                    <div className="space-y-2">
                        {displayableBets.map((bet, idx) => {
                            const isActive = bet.status === 0;
                            const isWon = bet.status === 1;
                            const isLost = bet.status === 2;
                            const directionText = bet.direction === 1 ? "UP ⬆️" : "DOWN ⬇️";
                            const statusText = isActive ? "Active" : isWon ? "Won ✅" : "Lost ❌";
                            const statusColor = isActive ? "text-yellow-400" : isWon ? "text-green-400" : "text-red-400";

                            return (
                                <div key={idx} className="bg-gray-800 p-3 rounded-lg text-xs">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-gray-400">Direction:</span>
                                        <span className="font-semibold">{directionText}</span>
                                    </div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-gray-400">Amount:</span>
                                        <span>{bet.amountStaked} pts</span>
                                    </div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-gray-400">Status:</span>
                                        <span className={statusColor}>{statusText}</span>
                                    </div>
                                    {bet.initialPrice > 0 && (
                                        <div className="flex justify-between mb-1">
                                            <span className="text-gray-400">Entry:</span>
                                            <span>${(bet.initialPrice / 1_000_000).toFixed(2)}</span>
                                        </div>
                                    )}
                                    {!isActive && bet.resolvedPrice > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Exit:</span>
                                            <span>${(bet.resolvedPrice / 1_000_000).toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
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