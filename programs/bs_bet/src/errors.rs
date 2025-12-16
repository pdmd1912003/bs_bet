use anchor_lang::prelude::*;

#[error_code]
pub enum BetError {
	#[msg("Timestamp calculation resulted in an overflow.")]
	TimestampOverflow,
	#[msg("Invalid Pyth Feed ID hex format.")]
	InvalidPythFeedIdFormat,
	#[msg("Pyth price feed error or price unavailable/too old.")]
	PythPriceFeedError,
	#[msg("Pyth price is too old or currently unavailable.")]
	PythPriceTooOldOrUnavailable,
	#[msg("Asset not supported by this program/feed.")]
	UnsupportedAsset,
	#[msg("Pyth reported a negative price.")]
	NegativePythPrice,
	#[msg("Price calculation resulted in an overflow during scaling.")]
	PriceCalculationOverflow,
	#[msg("Bet is not active or has already been resolved/claimed.")]
	BetNotActiveOrAlreadyResolved,
	#[msg("Bet has not yet expired and cannot be resolved.")]
	BetNotYetExpired,
	#[msg("User does not have enough points for this bet.")]
	InsufficientPoints,
	#[msg("The user profile's authority does not match the signer.")]
	UserProfileAuthorityMismatch,
	#[msg("The user profile does not belong to the user who placed the bet.")]
	UserProfileBetUserMismatch,
	#[msg("Bet direction must be 0 (DOWN) or 1 (UP).")]
	InvalidDirection,
	#[msg("Bet amount must be greater than zero.")]
	ZeroAmount,
	#[msg("Bet duration must be positive.")]
	InvalidDuration,
	#[msg("User is not properly authenticated or state not delegated for this action.")]
	NotAuthenticatedOrDelegated,
	#[msg("User authentication state is already prepared for MagicBlock delegation or fully delegated.")]
	AlreadyDelegated,
	#[msg("User authentication state is not currently in a MagicBlock delegated state.")]
	NotDelegated,
	#[msg("Account is delegated; use quick-bet instructions.")]
	DelegatedUseQuickBet,
	#[msg("Invalid authentication signature or message provided for delegation.")]
	InvalidDelegationSignature,
}
