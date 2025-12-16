use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::instructions as sysvar_instructions;

use crate::constants::AUTH_STATE;
use crate::errors::BetError;
use crate::state::UserAuthState;

#[derive(Accounts)]
#[instruction(delegation_action: u8, user_signed_message: Vec<u8>, _signature: [u8; 64])]
pub struct ManageDelegation<'info> {
    #[account(
        mut,
        seeds = [AUTH_STATE, user_authority.key().as_ref()],
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

impl<'info> ManageDelegation<'info> {
    pub fn assert_authority_matches(&self) -> Result<()> {
        require!(
            self.user_auth_state.user_authority == self.user_authority.key(),
            BetError::UserProfileAuthorityMismatch
        );
        Ok(())
    }
}
