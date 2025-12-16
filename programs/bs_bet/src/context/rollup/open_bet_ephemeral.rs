use anchor_lang::prelude::*;

use ephemeral_rollups_sdk::anchor::commit;
use pyth_solana_receiver_sdk::price_update::get_feed_id_from_hex;
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;

use crate::constants::{MAXIMUM_PRICE_AGE_SECONDS, SOL_USD_FEED_ID_HEX};
use crate::errors::BetError;
use crate::state::{ActiveBet, UserAuthState, UserProfile};

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

impl<'info> OpenBetEphemeral<'info> {
    pub fn open_bet_ephemeral(
        &self,
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

        let auth_state: UserAuthState = {
            let data = self.user_auth_state.try_borrow_data()?;
            UserAuthState::try_deserialize(&mut &data[..])
                .map_err(|_| error!(BetError::NotAuthenticatedOrDelegated))?
        };
        require!(auth_state.is_delegated, BetError::NotDelegated);
        require!(
            auth_state.user_authority == user_authority_for_pdas,
            BetError::UserProfileAuthorityMismatch
        );

        let mut user_profile: UserProfile = {
            let data = self.user_profile.try_borrow_data()?;
            UserProfile::try_deserialize(&mut &data[..])
                .map_err(|_| error!(BetError::UserProfileAuthorityMismatch))?
        };
        require!(
            user_profile.authority == user_authority_for_pdas,
            BetError::UserProfileAuthorityMismatch
        );
        require!(user_profile.points >= amount_arg, BetError::InsufficientPoints);

        let mut active_bet: ActiveBet = {
            let data = self.active_bet.try_borrow_data()?;
            ActiveBet::try_deserialize(&mut &data[..])
                .map_err(|_| error!(BetError::BetNotActiveOrAlreadyResolved))?
        };

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

        {
            let mut data = self.user_profile.try_borrow_mut_data()?;
            user_profile.try_serialize(&mut &mut data[..])?;
        }
        {
            let mut data = self.active_bet.try_borrow_mut_data()?;
            active_bet.try_serialize(&mut &mut data[..])?;
        }
        {
            let mut data = self.user_auth_state.try_borrow_mut_data()?;
            auth_state.try_serialize(&mut &mut data[..])?;
        }

        Ok(())
    }
}
