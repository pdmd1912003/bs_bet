use anchor_lang::prelude::*;

use ephemeral_rollups_sdk::anchor::delegate;
use ephemeral_rollups_sdk::cpi::DelegateConfig;

use crate::constants::AUTH_STATE;

#[delegate]
#[derive(Accounts)]
pub struct DelegateAuthState<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: UserAuthState PDA to delegate.
    #[account(
        mut,
        del,
        seeds = [AUTH_STATE, payer.key().as_ref()],
        bump
    )]
    pub pda: AccountInfo<'info>,
}

impl<'info> DelegateAuthState<'info> {
    pub fn delegate_accounts(&self) -> Result<()> {
        self.delegate_pda(
            &self.payer,
            &[AUTH_STATE, self.payer.key().as_ref()],
            DelegateConfig::default(),
        )?;
        Ok(())
    }
}
