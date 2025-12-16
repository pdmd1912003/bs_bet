use anchor_lang::prelude::*;

use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;
use pyth_solana_receiver_sdk::price_update::get_feed_id_from_hex;

use crate::constants::{ACTIVE_BET, AUTH_STATE, PROFILE};
use crate::constants::{MAXIMUM_PRICE_AGE_SECONDS, SOL_USD_FEED_ID_HEX};
use crate::errors::BetError;
use crate::state::{ActiveBet, UserAuthState, UserProfile, ACTIVE_BET_SPACE};

#[derive(Accounts)]
pub struct OpenBetNormal<'info> {
    #[account(mut)]
    pub user_signer: Signer<'info>,
    #[account(
        mut,
        seeds = [AUTH_STATE, user_signer.key().as_ref()],
        bump = user_auth_state.bump,
        constraint = user_auth_state.user_authority == user_signer.key() @ BetError::UserProfileAuthorityMismatch,
        constraint = !user_auth_state.is_delegated @ BetError::DelegatedUseQuickBet
    )]
    pub user_auth_state: Account<'info, UserAuthState>,
    #[account(
        mut,
        seeds = [PROFILE, user_signer.key().as_ref()],
        bump = user_profile.bump,
        constraint = user_profile.authority == user_signer.key() @ BetError::UserProfileAuthorityMismatch
    )]
    pub user_profile: Account<'info, UserProfile>,
    #[account(
        init_if_needed,
        payer = user_signer,
        space = 8 + ACTIVE_BET_SPACE,
        seeds = [ACTIVE_BET, user_signer.key().as_ref()],
        bump
    )]
    pub active_bet: Account<'info, ActiveBet>,
    pub pyth_price_feed: Account<'info, PriceUpdateV2>,
    pub system_program: Program<'info, System>,
}

impl<'info> OpenBetNormal<'info> {
    pub fn open_bet_normal(
        &mut self,
        asset_name_arg: String,
        direction_arg: u8,
        amount_arg: u64,
        duration_seconds_arg: i64,
        active_bet_bump: u8,
    ) -> Result<()> {
        require!(
            !self.user_auth_state.is_delegated,
            BetError::DelegatedUseQuickBet
        );

        let user_key = self.user_signer.key();
        let user_profile = &mut self.user_profile;
        let active_bet = &mut self.active_bet;

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
        let target_feed_id =
            get_feed_id_from_hex(SOL_USD_FEED_ID_HEX).map_err(|_| BetError::InvalidPythFeedIdFormat)?;
        let current_pyth_price_struct = self
            .pyth_price_feed
            .get_price_no_older_than(&clock, MAXIMUM_PRICE_AGE_SECONDS, &target_feed_id)
            .map_err(|_| BetError::PythPriceFeedError)?;

        let initial_price = crate::scale_pyth_price_to_6_decimals(
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
        active_bet.bump = active_bet_bump;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct ResolveBetNormal<'info> {
    #[account(mut)]
    pub user_signer: Signer<'info>,
    #[account(
        mut,
        seeds = [AUTH_STATE, user_signer.key().as_ref()],
        bump = user_auth_state.bump,
        constraint = !user_auth_state.is_delegated @ BetError::DelegatedUseQuickBet
    )]
    pub user_auth_state: Account<'info, UserAuthState>,
    #[account(
        mut,
        seeds = [PROFILE, user_signer.key().as_ref()],
        bump = user_profile.bump,
        constraint = user_profile.authority == user_signer.key() @ BetError::UserProfileAuthorityMismatch
    )]
    pub user_profile: Account<'info, UserProfile>,
    #[account(
        mut,
        seeds = [ACTIVE_BET, user_signer.key().as_ref()],
        bump = active_bet.bump,
        constraint = active_bet.user == user_signer.key() @ BetError::UserProfileBetUserMismatch
    )]
    pub active_bet: Account<'info, ActiveBet>,
    pub pyth_price_feed: Account<'info, PriceUpdateV2>,
    pub clock: Sysvar<'info, Clock>,
}

impl<'info> ResolveBetNormal<'info> {
    pub fn resolve_bet_normal(&mut self) -> Result<()> {
        require!(
            !self.user_auth_state.is_delegated,
            BetError::DelegatedUseQuickBet
        );

        let bet = &mut self.active_bet;
        let user_profile = &mut self.user_profile;
        let clock = &self.clock;

        require!(bet.status == 0, BetError::BetNotActiveOrAlreadyResolved);
        require!(
            clock.unix_timestamp > bet.expiry_timestamp,
            BetError::BetNotYetExpired
        );

        let target_feed_id =
            get_feed_id_from_hex(SOL_USD_FEED_ID_HEX).map_err(|_| BetError::InvalidPythFeedIdFormat)?;
        let resolved_price_struct = self
            .pyth_price_feed
            .get_price_no_older_than(clock, MAXIMUM_PRICE_AGE_SECONDS, &target_feed_id)
            .map_err(|_| BetError::PythPriceFeedError)?;
        bet.resolved_price = crate::scale_pyth_price_to_6_decimals(
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
}
