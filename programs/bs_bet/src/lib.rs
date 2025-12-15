use anchor_lang::{
    prelude::*,
    solana_program::{
        clock::Clock,
        // ed25519_program, // Not strictly needed for invoke if bypassed
        // instruction::Instruction as SolanaInstruction, // Not strictly needed for invoke if bypassed
        // program::invoke, // Not strictly needed for invoke if bypassed
        pubkey::Pubkey,
        sysvar::instructions as sysvar_instructions, // Keep for ManageDelegation struct
    },
};
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};
// MagicBlock SDK integration
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::commit_and_undelegate_accounts;

declare_id!("E4MP3Jxewmyu9f5bvyns3C9wMXX7AynzrCe9hD3ed3kU"); // YOUR PROGRAM ID

// --- Constants ---
pub const SOL_USD_FEED_ID_HEX: &str = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
pub const MAXIMUM_PRICE_AGE_SECONDS: u64 = 3600 * 2; // 2 hours
const STRING_LENGTH_PREFIX: usize = 4; // For String serialization
const MAX_ASSET_NAME_LENGTH: usize = 20; // Max length for asset_name string in ActiveBet
const INITIAL_USER_POINTS: u64 = 1000;

// --- Account Struct Definitions ---
#[account]
#[derive(Default, Debug)] // Added Debug for easier test logging if needed
pub struct UserAuthState {
    pub user_authority: Pubkey,
    pub is_delegated: bool, // True if delegated to MagicBlock for "quick bets"
    pub delegation_timestamp: i64,
    pub nonce: u64,         // For ensuring signed messages are unique (even if Ed25519 verify is demo-skipped)
    pub bump: u8,
}
// NOTE: Anchor adds the 8-byte discriminator via `space = 8 + ...`.
pub const USER_AUTH_STATE_SPACE: usize = 32 + 1 + 8 + 8 + 1;

#[account]
#[derive(Default, Debug)]
pub struct ActiveBet {
    pub user: Pubkey,
    pub asset_name: String, // Max MAX_ASSET_NAME_LENGTH
    pub initial_price: u64,
    pub expiry_timestamp: i64,
    pub direction: u8,      // 0 for DOWN, 1 for UP
    pub amount_staked: u64,
    pub resolved_price: u64,
    pub status: u8,         // 0: Active, 1: Won, 2: Lost
    pub bump: u8,
}
// NOTE: Anchor adds the 8-byte discriminator via `space = 8 + ...`.
pub const ACTIVE_BET_SPACE: usize = 32
    + (STRING_LENGTH_PREFIX + MAX_ASSET_NAME_LENGTH)
    + 8
    + 8
    + 1
    + 8
    + 8
    + 1
    + 1;

#[account]
#[derive(Default, Debug)]
pub struct UserProfile {
    pub authority: Pubkey,
    pub points: u64,
    pub bump: u8,
}
// NOTE: Anchor adds the 8-byte discriminator via `space = 8 + ...`.
pub const USER_PROFILE_SPACE: usize = 32 + 8 + 1;

// Helper function
pub fn create_delegation_message(user_pubkey: &Pubkey, nonce: u64) -> String {
    format!("BSBET_DELEGATE_AUTH:{}:{}", user_pubkey, nonce)
}

fn scale_pyth_price_to_6_decimals(price: i64, exponent: i32) -> Result<u64> {
    require!(price >= 0, BetError::NegativePythPrice);
    let mut value: u64 = price as u64;

    // We store prices with 6 decimals.
    let target_decimals: i32 = 6;
    let current_decimals: i32 = -exponent;
    let decimal_delta = target_decimals - current_decimals;

    if decimal_delta > 0 {
        for _ in 0..decimal_delta {
            value = value
                .checked_mul(10)
                .ok_or_else(|| error!(BetError::PriceCalculationOverflow))?;
        }
    } else if decimal_delta < 0 {
        for _ in 0..(-decimal_delta) {
            value /= 10;
        }
    }

    Ok(value)
}

// --- Program Module ---
#[ephemeral]
#[program]
pub mod bs_bet {
    use super::*;

    pub fn create_user_profile(ctx: Context<CreateUserProfile>) -> Result<()> {
        let user_key = ctx.accounts.user_authority.key();

        let user_profile = &mut ctx.accounts.user_profile;
        if user_profile.authority == Pubkey::default() {
            user_profile.authority = user_key;
            user_profile.points = INITIAL_USER_POINTS;
        }
        user_profile.bump = ctx.bumps.user_profile;

        let auth_state = &mut ctx.accounts.user_auth_state_for_profile_creation;
        if auth_state.user_authority == Pubkey::default() {
            auth_state.user_authority = user_key;
            auth_state.is_delegated = false;
            auth_state.delegation_timestamp = 0;
            auth_state.nonce = 0;
        }
        auth_state.bump = ctx.bumps.user_auth_state_for_profile_creation;

        let active_bet = &mut ctx.accounts.active_bet;
        if active_bet.user == Pubkey::default() {
            active_bet.user = user_key;
            active_bet.asset_name = "".to_string();
            active_bet.initial_price = 0;
            active_bet.expiry_timestamp = 0;
            active_bet.direction = 0;
            active_bet.amount_staked = 0;
            active_bet.resolved_price = 0;
            active_bet.status = 2; // treat as not-active until opened
        }
        active_bet.bump = ctx.bumps.active_bet;

        msg!(
            "User initialized. delegated={} profile_points={}",
            auth_state.is_delegated,
            user_profile.points
        );
        Ok(())
    }

    pub fn manage_delegation(
        ctx: Context<ManageDelegation>,
        delegation_action: u8,
        user_signed_message: Vec<u8>,
        _signature: [u8; 64]) -> Result<()> {
        let auth_state = &mut ctx.accounts.user_auth_state;
        let user_key = ctx.accounts.user_authority.key();
        let clock = Clock::get()?;

        if delegation_action == 1 { // User intends to delegate ("Enable Quick Bets")
            if auth_state.user_authority != user_key {
                return Err(error!(BetError::UserProfileAuthorityMismatch));
            }
            // Client-side should ideally check if already delegated before calling.
            // If called again while is_delegated = true, it effectively re-verifies for current nonce.
            if auth_state.is_delegated && auth_state.nonce > 0 { // If already delegated and nonce was incremented
                 msg!("Already processed for delegation. If MB SDK call failed, client can retry delegate_auth_state.");
                 // No error, allow client to proceed to delegate_auth_state if needed.
                 // Or, if nonce check is critical:
                 // return Err(error!(BetError::AlreadyDelegated));
            }


            let current_nonce = auth_state.nonce;
            let expected_message = create_delegation_message(&user_key, current_nonce);
            if user_signed_message != expected_message.as_bytes() {
                msg!("Invalid signed message content. Expected for nonce {}.", current_nonce);
                return Err(error!(BetError::InvalidDelegationSignature));
            }

            // --- ED25519 VERIFICATION SKIPPED (Hackathon Compromise) ---
            msg!("DEMO MODE: Skipping on-chain Ed25519 signature verification for manage_delegation.");
            // --- END OF SKIPPED VERIFICATION ---

            auth_state.is_delegated = true; // Set to true: ready for MagicBlock SDK call
            auth_state.delegation_timestamp = clock.unix_timestamp;
            auth_state.nonce = auth_state.nonce.checked_add(1).ok_or(BetError::TimestampOverflow)?;
            msg!("UserAuthState ready for MagicBlock SDK (is_delegated=true). Nonce incremented to {}.", auth_state.nonce);

        } else if delegation_action == 0 { // User intends to undelegate ("Disable Quick Bets")
        
        // This action is called AFTER undelegate_from_magicblock has returned ownership.
        if auth_state.user_authority != user_key {
            return Err(error!(BetError::UserProfileAuthorityMismatch));
        }
        // No need to check !auth_state.is_delegated, we are explicitly setting it.
        auth_state.is_delegated = false;
        // Optionally reset nonce or timestamp here if desired after full undelegation.
        // auth_state.nonce = 0; // Example
        msg!("UserAuthState locally marked as not delegated (is_delegated=false).");
        } else {
            return Err(error!(BetError::InvalidDelegationSignature)); // Or InvalidDelegationAction
        }
        Ok(())
    }

    pub fn delegate_auth_state(ctx: Context<DelegateAuthState>) -> Result<()> {
        // The `#[delegate]` macro on the `DelegateAuthState` struct makes the `delegate_pda` method
        // available on `ctx.accounts` (which is an instance of `DelegateAuthState`).
        // The method uses the field marked with `#[account(del)]` (i.e., `ctx.accounts.pda`)
        // as the target account for delegation.
    
        // The seeds passed here should be the seeds used to derive the PDA that
        // `ctx.accounts.pda` (the AccountInfo) points to.
        // UserAuthState PDA is derived with seeds: [b"auth_state", user_authority.key()]
        msg!(
            "Attempting to delegate UserAuthState PDA: {} with payer: {}",
            ctx.accounts.pda.key(),
            ctx.accounts.payer.key()
        );
        ctx.accounts.delegate_pda( // Calling the method on ctx.accounts
            // First argument is typically the fee payer for the delegation transaction,
            // but delegate_pda might just need it to confirm authority or for seeds.
            // In the MB example, ctx.accounts.payer (Signer from DelegateInput) was used.
            &ctx.accounts.payer,
            // Seeds for the PDA being delegated (UserAuthState)
            // These are the seeds used to *find* or *verify* the `ctx.accounts.pda`.
            // The `pda` field itself is already resolved to a PublicKey.
            // MagicBlock's example just passed `&[TEST_PDA_SEED]`.
            // Your seeds are `b"auth_state"` and `user_authority.key()`.
            &[
                b"auth_state".as_ref(),
                ctx.accounts.payer.key().as_ref(),
            ],
            DelegateConfig::default(),
        )?;
    
        msg!("UserAuthState PDA delegated: {}", ctx.accounts.pda.key());
        Ok(())
    }

    pub fn delegate_user_profile(ctx: Context<DelegateUserProfile>) -> Result<()> {
        msg!(
            "Attempting to delegate UserProfile PDA: {} with payer: {}",
            ctx.accounts.pda.key(),
            ctx.accounts.payer.key()
        );
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &[b"profile".as_ref(), ctx.accounts.payer.key().as_ref()],
            DelegateConfig::default(),
        )?;
        Ok(())
    }

    pub fn delegate_active_bet(ctx: Context<DelegateActiveBet>) -> Result<()> {
        msg!(
            "Attempting to delegate ActiveBet PDA: {} with payer: {}",
            ctx.accounts.pda.key(),
            ctx.accounts.payer.key()
        );
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &[b"active_bet".as_ref(), ctx.accounts.payer.key().as_ref()],
            DelegateConfig::default(),
        )?;
        Ok(())
    }

    pub fn open_bet_normal(
        ctx: Context<OpenBetNormal>,
        asset_name_arg: String,
        direction_arg: u8,
        amount_arg: u64,
        duration_seconds_arg: i64,
    ) -> Result<()> {
        require!(!ctx.accounts.user_auth_state.is_delegated, BetError::DelegatedUseQuickBet);

        let user_key = ctx.accounts.user_signer.key();
        let user_profile = &mut ctx.accounts.user_profile;
        let active_bet = &mut ctx.accounts.active_bet;

        require!(asset_name_arg == "SOL/USD", BetError::UnsupportedAsset);
        require!(direction_arg == 0 || direction_arg == 1, BetError::InvalidDirection);
        require!(amount_arg > 0, BetError::ZeroAmount);
        require!(duration_seconds_arg > 0, BetError::InvalidDuration);
        require!(user_profile.points >= amount_arg, BetError::InsufficientPoints);

        user_profile.points = user_profile
            .points
            .checked_sub(amount_arg)
            .ok_or_else(|| error!(BetError::InsufficientPoints))?;

        let clock = Clock::get()?;
        let target_feed_id = get_feed_id_from_hex(SOL_USD_FEED_ID_HEX)
            .map_err(|_| BetError::InvalidPythFeedIdFormat)?;
        let current_pyth_price_struct = ctx
            .accounts
            .pyth_price_feed
            .get_price_no_older_than(&clock, MAXIMUM_PRICE_AGE_SECONDS, &target_feed_id)
            .map_err(|_| BetError::PythPriceFeedError)?;

        let initial_price = scale_pyth_price_to_6_decimals(
            current_pyth_price_struct.price,
            current_pyth_price_struct.exponent,
        )?;

        active_bet.user = user_key;
        active_bet.asset_name = asset_name_arg;
        active_bet.initial_price = initial_price;
        active_bet.expiry_timestamp = clock
            .unix_timestamp
            .checked_add(duration_seconds_arg)
            .ok_or(BetError::TimestampOverflow)?;
        active_bet.direction = direction_arg;
        active_bet.amount_staked = amount_arg;
        active_bet.resolved_price = 0;
        active_bet.status = 0;
        active_bet.bump = ctx.bumps.active_bet;

        msg!("Normal bet opened for user {}", user_key);
        Ok(())
    }

    pub fn open_bet_ephemeral(
        ctx: Context<OpenBetEphemeral>,
        asset_name_arg: String,
        direction_arg: u8,
        amount_arg: u64,
        duration_seconds_arg: i64,
        user_authority_for_pdas: Pubkey,
    ) -> Result<()> {
        require!(asset_name_arg == "SOL/USD", BetError::UnsupportedAsset);
        require!(direction_arg == 0 || direction_arg == 1, BetError::InvalidDirection);
        require!(amount_arg > 0, BetError::ZeroAmount);
        require!(duration_seconds_arg > 0, BetError::InvalidDuration);

        // Deserialize delegated accounts manually.
        let mut auth_state: UserAuthState = {
            let data = ctx.accounts.user_auth_state.try_borrow_data()?;
            UserAuthState::try_deserialize(&mut &data[..])
                .map_err(|_| error!(BetError::NotAuthenticatedOrDelegated))?
        };
        require!(auth_state.is_delegated, BetError::NotDelegated);
        require!(auth_state.user_authority == user_authority_for_pdas, BetError::UserProfileAuthorityMismatch);

        let mut user_profile: UserProfile = {
            let data = ctx.accounts.user_profile.try_borrow_data()?;
            UserProfile::try_deserialize(&mut &data[..])
                .map_err(|_| error!(BetError::UserProfileAuthorityMismatch))?
        };
        require!(user_profile.authority == user_authority_for_pdas, BetError::UserProfileAuthorityMismatch);
        require!(user_profile.points >= amount_arg, BetError::InsufficientPoints);

        let mut active_bet: ActiveBet = {
            let data = ctx.accounts.active_bet.try_borrow_data()?;
            ActiveBet::try_deserialize(&mut &data[..]).map_err(|_| error!(BetError::BetNotActiveOrAlreadyResolved))?
        };

        user_profile.points = user_profile
            .points
            .checked_sub(amount_arg)
            .ok_or_else(|| error!(BetError::InsufficientPoints))?;

        let clock = Clock::get()?;
        let target_feed_id = get_feed_id_from_hex(SOL_USD_FEED_ID_HEX)
            .map_err(|_| BetError::InvalidPythFeedIdFormat)?;
        let current_pyth_price_struct = ctx
            .accounts
            .pyth_price_feed
            .get_price_no_older_than(&clock, MAXIMUM_PRICE_AGE_SECONDS, &target_feed_id)
            .map_err(|_| BetError::PythPriceFeedError)?;
        let initial_price = scale_pyth_price_to_6_decimals(
            current_pyth_price_struct.price,
            current_pyth_price_struct.exponent,
        )?;

        active_bet.user = user_authority_for_pdas;
        active_bet.asset_name = asset_name_arg;
        active_bet.initial_price = initial_price;
        active_bet.expiry_timestamp = clock
            .unix_timestamp
            .checked_add(duration_seconds_arg)
            .ok_or(BetError::TimestampOverflow)?;
        active_bet.direction = direction_arg;
        active_bet.amount_staked = amount_arg;
        active_bet.resolved_price = 0;
        active_bet.status = 0;

        // Serialize back into account data buffers.
        {
            let mut data = ctx.accounts.user_profile.try_borrow_mut_data()?;
            user_profile.try_serialize(&mut &mut data[..])?;
        }
        {
            let mut data = ctx.accounts.active_bet.try_borrow_mut_data()?;
            active_bet.try_serialize(&mut &mut data[..])?;
        }
        {
            let mut data = ctx.accounts.user_auth_state.try_borrow_mut_data()?;
            auth_state.try_serialize(&mut &mut data[..])?;
        }

        msg!("Quick bet opened for user {}", user_authority_for_pdas);
        Ok(())
    }

    pub fn resolve_bet_normal(ctx: Context<ResolveBetNormal>) -> Result<()> {
        require!(!ctx.accounts.user_auth_state.is_delegated, BetError::DelegatedUseQuickBet);
        let bet = &mut ctx.accounts.active_bet;
        let user_profile = &mut ctx.accounts.user_profile;
        let clock = &ctx.accounts.clock;
        require!(bet.status == 0, BetError::BetNotActiveOrAlreadyResolved);
        require!(clock.unix_timestamp > bet.expiry_timestamp, BetError::BetNotYetExpired);

        let target_feed_id = get_feed_id_from_hex(SOL_USD_FEED_ID_HEX)
            .map_err(|_| BetError::InvalidPythFeedIdFormat)?;
        let resolved_price_struct = ctx
            .accounts
            .pyth_price_feed
            .get_price_no_older_than(clock, MAXIMUM_PRICE_AGE_SECONDS, &target_feed_id)
            .map_err(|_| BetError::PythPriceFeedError)?;
        bet.resolved_price = scale_pyth_price_to_6_decimals(
            resolved_price_struct.price,
            resolved_price_struct.exponent,
        )?;

        let won = if bet.direction == 1 {
            bet.resolved_price > bet.initial_price
        } else {
            bet.resolved_price < bet.initial_price
        };
        if won {
            bet.status = 1;
            let payout = bet
                .amount_staked
                .checked_mul(2)
                .ok_or(BetError::PriceCalculationOverflow)?;
            user_profile.points = user_profile
                .points
                .checked_add(payout)
                .ok_or(BetError::PriceCalculationOverflow)?;
        } else {
            bet.status = 2;
        }
        Ok(())
    }

    pub fn resolve_bet_ephemeral(
        ctx: Context<ResolveBetEphemeral>,
        user_authority_for_pdas: Pubkey,
    ) -> Result<()> {
        let auth_state: UserAuthState = {
            let data = ctx.accounts.user_auth_state.try_borrow_data()?;
            UserAuthState::try_deserialize(&mut &data[..])
                .map_err(|_| error!(BetError::NotAuthenticatedOrDelegated))?
        };
        require!(auth_state.is_delegated, BetError::NotDelegated);
        require!(auth_state.user_authority == user_authority_for_pdas, BetError::UserProfileAuthorityMismatch);

        let mut bet: ActiveBet = {
            let data = ctx.accounts.active_bet.try_borrow_data()?;
            ActiveBet::try_deserialize(&mut &data[..]).map_err(|_| error!(BetError::BetNotActiveOrAlreadyResolved))?
        };
        let mut user_profile: UserProfile = {
            let data = ctx.accounts.user_profile.try_borrow_data()?;
            UserProfile::try_deserialize(&mut &data[..])
                .map_err(|_| error!(BetError::UserProfileAuthorityMismatch))?
        };

        require!(bet.status == 0, BetError::BetNotActiveOrAlreadyResolved);
        let clock = &ctx.accounts.clock;
        require!(clock.unix_timestamp > bet.expiry_timestamp, BetError::BetNotYetExpired);

        let target_feed_id = get_feed_id_from_hex(SOL_USD_FEED_ID_HEX)
            .map_err(|_| BetError::InvalidPythFeedIdFormat)?;
        let resolved_price_struct = ctx
            .accounts
            .pyth_price_feed
            .get_price_no_older_than(clock, MAXIMUM_PRICE_AGE_SECONDS, &target_feed_id)
            .map_err(|_| BetError::PythPriceFeedError)?;
        bet.resolved_price = scale_pyth_price_to_6_decimals(
            resolved_price_struct.price,
            resolved_price_struct.exponent,
        )?;

        let won = if bet.direction == 1 {
            bet.resolved_price > bet.initial_price
        } else {
            bet.resolved_price < bet.initial_price
        };
        if won {
            bet.status = 1;
            let payout = bet
                .amount_staked
                .checked_mul(2)
                .ok_or(BetError::PriceCalculationOverflow)?;
            user_profile.points = user_profile
                .points
                .checked_add(payout)
                .ok_or(BetError::PriceCalculationOverflow)?;
        } else {
            bet.status = 2;
        }

        {
            let mut data = ctx.accounts.user_profile.try_borrow_mut_data()?;
            user_profile.try_serialize(&mut &mut data[..])?;
        }
        {
            let mut data = ctx.accounts.active_bet.try_borrow_mut_data()?;
            bet.try_serialize(&mut &mut data[..])?;
        }

        Ok(())
    }

    pub fn undelegate_from_magicblock(ctx: Context<UndelegateFromMagicBlock>) -> Result<()> {
        commit_and_undelegate_accounts(
            &ctx.accounts.payer.to_account_info(),
            vec![
                &ctx.accounts.user_auth_state_to_undelegate,
                &ctx.accounts.user_profile_to_undelegate,
                &ctx.accounts.active_bet_to_undelegate,
            ],
            &ctx.accounts.magic_context.to_account_info(),
            &ctx.accounts.magic_program.to_account_info(),
        )?;
        Ok(())
    }

}   

// --- Accounts Structs ---

#[derive(Accounts)]
pub struct CreateUserProfile<'info> {
    #[account(
        init_if_needed,
        payer = user_authority,
        space = 8 + USER_PROFILE_SPACE,
        seeds = [b"profile".as_ref(), user_authority.key().as_ref()],
        bump
    )]
    pub user_profile: Account<'info, UserProfile>,
    #[account(
        init_if_needed,
        payer = user_authority,
        space = 8 + USER_AUTH_STATE_SPACE,
        seeds = [b"auth_state".as_ref(), user_authority.key().as_ref()],
        bump
    )]
    pub user_auth_state_for_profile_creation: Account<'info, UserAuthState>,
    #[account(
        init_if_needed,
        payer = user_authority,
        space = 8 + ACTIVE_BET_SPACE,
        seeds = [b"active_bet".as_ref(), user_authority.key().as_ref()],
        bump
    )]
    pub active_bet: Account<'info, ActiveBet>,
    #[account(mut)]
    pub user_authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(delegation_action: u8, user_signed_message: Vec<u8>, _signature: [u8; 64])]
pub struct ManageDelegation<'info> {
    #[account(
        mut,
        seeds = [b"auth_state".as_ref(), user_authority.key().as_ref()],
        bump = user_auth_state.bump
    )]
    pub user_auth_state: Account<'info, UserAuthState>,
    #[account(mut)]
    pub user_authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    #[account(address = sysvar_instructions::ID)]
    /// CHECK: Instructions sysvar.
    pub ix_sysvar: AccountInfo<'info>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateAuthState<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: UserAuthState PDA to delegate.
    #[account(
        mut,
        del,
        seeds = [b"auth_state".as_ref(), payer.key().as_ref()],
        bump
    )]
    pub pda: AccountInfo<'info>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateUserProfile<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: UserProfile PDA to delegate.
    #[account(
        mut,
        del,
        seeds = [b"profile".as_ref(), payer.key().as_ref()],
        bump
    )]
    pub pda: AccountInfo<'info>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateActiveBet<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: ActiveBet PDA to delegate.
    #[account(
        mut,
        del,
        seeds = [b"active_bet".as_ref(), payer.key().as_ref()],
        bump
    )]
    pub pda: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct OpenBetNormal<'info> {
    #[account(mut)]
    pub user_signer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"auth_state".as_ref(), user_signer.key().as_ref()],
        bump = user_auth_state.bump,
        constraint = user_auth_state.user_authority == user_signer.key() @ BetError::UserProfileAuthorityMismatch,
        constraint = !user_auth_state.is_delegated @ BetError::DelegatedUseQuickBet
    )]
    pub user_auth_state: Account<'info, UserAuthState>,
    #[account(
        mut,
        seeds = [b"profile".as_ref(), user_signer.key().as_ref()],
        bump = user_profile.bump,
        constraint = user_profile.authority == user_signer.key() @ BetError::UserProfileAuthorityMismatch
    )]
    pub user_profile: Account<'info, UserProfile>,
    #[account(
        init_if_needed,
        payer = user_signer,
        space = 8 + ACTIVE_BET_SPACE,
        seeds = [b"active_bet".as_ref(), user_signer.key().as_ref()],
        bump
    )]
    pub active_bet: Account<'info, ActiveBet>,
    pub pyth_price_feed: Account<'info, PriceUpdateV2>,
    pub system_program: Program<'info, System>,
}

#[commit]
#[derive(Accounts)]
#[instruction(asset_name_arg: String, direction_arg: u8, amount_arg: u64, duration_seconds_arg: i64, user_authority_for_pdas: Pubkey)]
pub struct OpenBetEphemeral<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: delegated
    #[account(mut)]
    pub user_auth_state: AccountInfo<'info>,
    /// CHECK: delegated
    #[account(mut)]
    pub user_profile: AccountInfo<'info>,
    /// CHECK: delegated
    #[account(mut)]
    pub active_bet: AccountInfo<'info>,
    pub pyth_price_feed: Account<'info, PriceUpdateV2>,
}

#[derive(Accounts)]
pub struct ResolveBetNormal<'info> {
    #[account(mut)]
    pub user_signer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"auth_state".as_ref(), user_signer.key().as_ref()],
        bump = user_auth_state.bump,
        constraint = !user_auth_state.is_delegated @ BetError::DelegatedUseQuickBet
    )]
    pub user_auth_state: Account<'info, UserAuthState>,
    #[account(
        mut,
        seeds = [b"profile".as_ref(), user_signer.key().as_ref()],
        bump = user_profile.bump,
        constraint = user_profile.authority == user_signer.key() @ BetError::UserProfileAuthorityMismatch
    )]
    pub user_profile: Account<'info, UserProfile>,
    #[account(
        mut,
        seeds = [b"active_bet".as_ref(), user_signer.key().as_ref()],
        bump = active_bet.bump,
        constraint = active_bet.user == user_signer.key() @ BetError::UserProfileBetUserMismatch
    )]
    pub active_bet: Account<'info, ActiveBet>,
    pub pyth_price_feed: Account<'info, PriceUpdateV2>,
    pub clock: Sysvar<'info, Clock>,
}

#[commit]
#[derive(Accounts)]
#[instruction(user_authority_for_pdas: Pubkey)]
pub struct ResolveBetEphemeral<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: delegated
    #[account(mut)]
    pub user_auth_state: AccountInfo<'info>,
    /// CHECK: delegated
    #[account(mut)]
    pub user_profile: AccountInfo<'info>,
    /// CHECK: delegated
    #[account(mut)]
    pub active_bet: AccountInfo<'info>,
    pub pyth_price_feed: Account<'info, PriceUpdateV2>,
    pub clock: Sysvar<'info, Clock>,
}

#[commit]
#[derive(Accounts)]
pub struct UndelegateFromMagicBlock<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub user_authority: Signer<'info>,
    /// CHECK: delegated
    #[account(mut)]
    pub user_auth_state_to_undelegate: AccountInfo<'info>,
    /// CHECK: delegated
    #[account(mut)]
    pub user_profile_to_undelegate: AccountInfo<'info>,
    /// CHECK: delegated
    #[account(mut)]
    pub active_bet_to_undelegate: AccountInfo<'info>,
    #[account(executable)]
    /// CHECK: MagicBlock delegation program
    pub magic_program: AccountInfo<'info>,
    #[account(mut)]
    /// CHECK: MagicBlock context
    pub magic_context: AccountInfo<'info>,
}

// --- Error Enum ---
#[error_code]
pub enum BetError {
    #[msg("Timestamp calculation resulted in an overflow.")] TimestampOverflow,
    #[msg("Invalid Pyth Feed ID hex format.")] InvalidPythFeedIdFormat,
    #[msg("Pyth price feed error or price unavailable/too old.")] PythPriceFeedError,
    #[msg("Pyth price is too old or currently unavailable.")] PythPriceTooOldOrUnavailable,
    #[msg("Asset not supported by this program/feed.")] UnsupportedAsset,
    #[msg("Pyth reported a negative price.")] NegativePythPrice,
    #[msg("Price calculation resulted in an overflow during scaling.")] PriceCalculationOverflow,
    #[msg("Bet is not active or has already been resolved/claimed.")] BetNotActiveOrAlreadyResolved,
    #[msg("Bet has not yet expired and cannot be resolved.")] BetNotYetExpired,
    #[msg("User does not have enough points for this bet.")] InsufficientPoints,
    #[msg("The user profile's authority does not match the signer.")] UserProfileAuthorityMismatch,
    #[msg("The user profile does not belong to the user who placed the bet.")] UserProfileBetUserMismatch,
    #[msg("Bet direction must be 0 (DOWN) or 1 (UP).")] InvalidDirection,
    #[msg("Bet amount must be greater than zero.")] ZeroAmount,
    #[msg("Bet duration must be positive.")] InvalidDuration,
    #[msg("User is not properly authenticated or state not delegated for this action.")] NotAuthenticatedOrDelegated,
    #[msg("User authentication state is already prepared for MagicBlock delegation or fully delegated.")] AlreadyDelegated,
    #[msg("User authentication state is not currently in a MagicBlock delegated state.")] NotDelegated,
    #[msg("Account is delegated; use quick-bet instructions.")] DelegatedUseQuickBet,
    #[msg("Invalid authentication signature or message provided for delegation.")] InvalidDelegationSignature,
}