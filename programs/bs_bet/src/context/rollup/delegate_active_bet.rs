use anchor_lang::prelude::*;

use ephemeral_rollups_sdk::anchor::delegate;
use ephemeral_rollups_sdk::cpi::DelegateConfig;

use crate::constants::ACTIVE_BET;

#[delegate]
#[derive(Accounts)]
pub struct DelegateActiveBet<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: ActiveBet PDA to delegate.
    #[account(
        mut,
        del,
        seeds = [ACTIVE_BET, payer.key().as_ref()],
        bump
    )]
    pub pda: AccountInfo<'info>,
}

impl<'info> DelegateActiveBet<'info> {
    pub fn delegate_accounts(&self) -> Result<()> {
        self.delegate_pda(
            &self.payer,
            &[ACTIVE_BET, self.payer.key().as_ref()],
            DelegateConfig::default(),
        )?;
        Ok(())
    }
}
