use anchor_lang::prelude::*;
// (pyth helper imports live in context impls)

// MagicBlock SDK integration
use ephemeral_rollups_sdk::anchor::ephemeral;
use ephemeral_rollups_sdk::ephem::commit_and_undelegate_accounts;

pub mod constants;
pub mod context;
pub mod errors;
pub mod state;

use crate::constants::*;
use crate::context::*;
use crate::errors::BetError;

declare_id!("3mhGnRYHNYJ4BMa5P7aGd9DYn3wSwxELNSYqNzRVbtKx"); // YOUR PROGRAM ID

// Helper function
pub fn create_delegation_message(user_pubkey: &Pubkey, nonce: u64) -> String {
    format!("BSBET_DELEGATE_AUTH:{}:{}", user_pubkey, nonce)
}

pub(crate) fn scale_pyth_price_to_6_decimals(price: i64, exponent: i32) -> Result<u64> {
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
            auth_state.bump = ctx.bumps.user_auth_state_for_profile_creation;
        }

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
        _signature: [u8; 64],
    ) -> Result<()> {
        ctx.accounts.assert_authority_matches()?;

        let auth_state = &mut ctx.accounts.user_auth_state;
        let user_key = ctx.accounts.user_authority.key();
        let clock = Clock::get()?;

        if delegation_action == 1 {
            // User intends to delegate ("Enable Quick Bets")
            if auth_state.user_authority != user_key {
                return Err(error!(BetError::UserProfileAuthorityMismatch));
            }
            // Client-side should ideally check if already delegated before calling.
            // If called again while is_delegated = true, it effectively re-verifies for current nonce.
            if auth_state.is_delegated && auth_state.nonce > 0 {
                // If already delegated and nonce was incremented
                msg!("Already processed for delegation. If MB SDK call failed, client can retry delegate_auth_state.");
                // No error, allow client to proceed to delegate_auth_state if needed.
                // Or, if nonce check is critical:
                // return Err(error!(BetError::AlreadyDelegated));
            }

            let current_nonce = auth_state.nonce;
            let expected_message = create_delegation_message(&user_key, current_nonce);
            if user_signed_message != expected_message.as_bytes() {
                msg!(
                    "Invalid signed message content. Expected for nonce {}.",
                    current_nonce
                );
                return Err(error!(BetError::InvalidDelegationSignature));
            }

            // --- ED25519 VERIFICATION SKIPPED (Hackathon Compromise) ---
            msg!("DEMO MODE: Skipping on-chain Ed25519 signature verification for manage_delegation.");
            // --- END OF SKIPPED VERIFICATION ---

            auth_state.is_delegated = true; // Set to true: ready for MagicBlock SDK call
            auth_state.delegation_timestamp = clock.unix_timestamp;
            auth_state.nonce = auth_state
                .nonce
                .checked_add(1)
                .ok_or(BetError::TimestampOverflow)?;
            msg!("UserAuthState ready for MagicBlock SDK (is_delegated=true). Nonce incremented to {}.", auth_state.nonce);
        } else if delegation_action == 0 {
            // User intends to undelegate ("Disable Quick Bets")

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
        ctx.accounts.delegate_accounts()?;
        Ok(())
    }

    pub fn delegate_user_profile(ctx: Context<DelegateUserProfile>) -> Result<()> {
        ctx.accounts.delegate_accounts()?;
        Ok(())
    }

    pub fn delegate_active_bet(ctx: Context<DelegateActiveBet>) -> Result<()> {
        ctx.accounts.delegate_accounts()?;
        Ok(())
    }

    pub fn open_bet_normal(
        ctx: Context<OpenBetNormal>,
        asset_name_arg: String,
        direction_arg: u8,
        amount_arg: u64,
        duration_seconds_arg: i64,
    ) -> Result<()> {
        ctx.accounts.open_bet_normal(
            asset_name_arg,
            direction_arg,
            amount_arg,
            duration_seconds_arg,
            ctx.bumps.active_bet,
        )?;
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
        ctx.accounts.open_bet_ephemeral(
            asset_name_arg,
            direction_arg,
            amount_arg,
            duration_seconds_arg,
            user_authority_for_pdas,
        )?;
        Ok(())
    }

    pub fn resolve_bet_normal(ctx: Context<ResolveBetNormal>) -> Result<()> {
        ctx.accounts.resolve_bet_normal()?;
        Ok(())
    }

    pub fn resolve_bet_ephemeral(
        ctx: Context<ResolveBetEphemeral>,
        user_authority_for_pdas: Pubkey,
    ) -> Result<()> {
        ctx.accounts
            .resolve_bet_ephemeral(user_authority_for_pdas)?;
        Ok(())
    }

    pub fn undelegate_from_magicblock(ctx: Context<UndelegateFromMagicBlock>) -> Result<()> {
        commit_and_undelegate_accounts(
            &ctx.accounts.payer,
            vec![
                &ctx.accounts.user_auth_state_to_undelegate.to_account_info(),
                &ctx.accounts.user_profile_to_undelegate.to_account_info(),
                &ctx.accounts.active_bet_to_undelegate.to_account_info(),
            ],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
        )?;
        Ok(())
    }
}
