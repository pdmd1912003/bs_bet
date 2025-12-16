use anchor_lang::prelude::*;

use ephemeral_rollups_sdk::anchor::commit;
use pyth_solana_receiver_sdk::price_update::get_feed_id_from_hex;
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;

use crate::constants::{MAXIMUM_PRICE_AGE_SECONDS, SOL_USD_FEED_ID_HEX};
use crate::errors::BetError;
use crate::state::{ActiveBet, UserAuthState, UserProfile};

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

impl<'info> ResolveBetEphemeral<'info> {
    pub fn resolve_bet_ephemeral(&self, user_authority_for_pdas: Pubkey) -> Result<()> {
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

        let mut bet: ActiveBet = {
            let data = self.active_bet.try_borrow_data()?;
            ActiveBet::try_deserialize(&mut &data[..])
                .map_err(|_| error!(BetError::BetNotActiveOrAlreadyResolved))?
        };
        let mut user_profile: UserProfile = {
            let data = self.user_profile.try_borrow_data()?;
            UserProfile::try_deserialize(&mut &data[..])
                .map_err(|_| error!(BetError::UserProfileAuthorityMismatch))?
        };

        require!(bet.status == 0, BetError::BetNotActiveOrAlreadyResolved);
        let clock = &self.clock;
        require!(clock.unix_timestamp > bet.expiry_timestamp, BetError::BetNotYetExpired);

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

        {
            let mut data = self.user_profile.try_borrow_mut_data()?;
            user_profile.try_serialize(&mut &mut data[..])?;
        }
        {
            let mut data = self.active_bet.try_borrow_mut_data()?;
            bet.try_serialize(&mut &mut data[..])?;
        }

        Ok(())
    }
}
