use anchor_lang::prelude::*;

use ephemeral_rollups_sdk::anchor::commit;

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
    /// CHECK: MagicBlock magic program (required by `commit_and_undelegate_accounts`).
    pub magic_program: AccountInfo<'info>,
    #[account(mut)]
    /// CHECK: MagicBlock context account (required by `commit_and_undelegate_accounts`).
    pub magic_context: AccountInfo<'info>,
}
