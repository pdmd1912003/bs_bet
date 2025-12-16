use anchor_lang::prelude::*;

use crate::constants::{ACTIVE_BET, AUTH_STATE, PROFILE};
use crate::state::{ActiveBet, UserAuthState, UserProfile, ACTIVE_BET_SPACE, USER_AUTH_STATE_SPACE, USER_PROFILE_SPACE};

#[derive(Accounts)]
pub struct CreateUserProfile<'info> {
    #[account(
        init_if_needed,
        payer = user_authority,
        space = 8 + USER_PROFILE_SPACE,
        seeds = [PROFILE, user_authority.key().as_ref()],
        bump
    )]
    pub user_profile: Account<'info, UserProfile>,
    #[account(
        init_if_needed,
        payer = user_authority,
        space = 8 + USER_AUTH_STATE_SPACE,
        seeds = [AUTH_STATE, user_authority.key().as_ref()],
        bump
    )]
    pub user_auth_state_for_profile_creation: Account<'info, UserAuthState>,
    #[account(
        init_if_needed,
        payer = user_authority,
        space = 8 + ACTIVE_BET_SPACE,
        seeds = [ACTIVE_BET, user_authority.key().as_ref()],
        bump
    )]
    pub active_bet: Account<'info, ActiveBet>,
    #[account(mut)]
    pub user_authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}