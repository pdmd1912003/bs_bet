use anchor_lang::prelude::*;

use ephemeral_rollups_sdk::anchor::delegate;
use ephemeral_rollups_sdk::cpi::DelegateConfig;

use crate::constants::PROFILE;

#[delegate]
#[derive(Accounts)]
pub struct DelegateUserProfile<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: UserProfile PDA to delegate.
    #[account(
        mut,
        del,
        seeds = [PROFILE, payer.key().as_ref()],
        bump
    )]
    pub pda: AccountInfo<'info>,
}

impl<'info> DelegateUserProfile<'info> {
    pub fn delegate_accounts(&self) -> Result<()> {
        self.delegate_pda(
            &self.payer,
            &[PROFILE, self.payer.key().as_ref()],
            DelegateConfig::default(),
        )?;
        Ok(())
    }
}
