use anchor_lang::prelude::*;

use crate::constants::{MAX_ASSET_NAME_LENGTH, STRING_LENGTH_PREFIX};

#[account]
#[derive(Default, Debug)]
pub struct UserAuthState {
	pub user_authority: Pubkey,
	pub is_delegated: bool,
	pub delegation_timestamp: i64,
	pub nonce: u64,
	pub bump: u8,
}

// NOTE: Anchor adds the 8-byte discriminator via `space = 8 + ...`.
pub const USER_AUTH_STATE_SPACE: usize = 32 + 1 + 8 + 8 + 1;

#[account]
#[derive(Default, Debug)]
pub struct ActiveBet {
	pub user: Pubkey,
	pub asset_name: String,
	pub initial_price: u64,
	pub expiry_timestamp: i64,
	pub direction: u8,
	pub amount_staked: u64,
	pub resolved_price: u64,
	pub status: u8,
	pub bump: u8,
}

// NOTE: Anchor adds the 8-byte discriminator via `space = 8 + ...`.
pub const ACTIVE_BET_SPACE: usize = 32
	+ (STRING_LENGTH_PREFIX + MAX_ASSET_NAME_LENGTH)
	+ 8
	+ 8
	+ 1
	+ 8
	+ 8
	+ 1
	+ 1;

#[account]
#[derive(Default, Debug)]
pub struct UserProfile {
	pub authority: Pubkey,
	pub points: u64,
	pub bump: u8,
}

// NOTE: Anchor adds the 8-byte discriminator via `space = 8 + ...`.
pub const USER_PROFILE_SPACE: usize = 32 + 8 + 1;
