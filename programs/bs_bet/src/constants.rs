// --- Pyth ---
pub const SOL_USD_FEED_ID_HEX: &str =
	"0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
pub const MAXIMUM_PRICE_AGE_SECONDS: u64 = 3600 * 2; // 2 hours

// --- Sizing helpers ---
pub const STRING_LENGTH_PREFIX: usize = 4;
pub const MAX_ASSET_NAME_LENGTH: usize = 20;

// --- App constants ---
pub const INITIAL_USER_POINTS: u64 = 1000;

// --- PDA seeds ---
pub const PROFILE: &[u8] = b"profile";
pub const AUTH_STATE: &[u8] = b"auth_state";
pub const ACTIVE_BET: &[u8] = b"active_bet";
