# Fuzzland Audit

## [H] Malformed callback revert data can abort liquidations and other balance-change paths

Resolved. On V2 chains, we set the callback gas limit to 0. On Arbitrum, the callback is not called for Trade actions so we created an InternalTradeLiquidator.

## [H] Borrow-position transfers orphan async settlement state and create ghost GM/GLV collateral

Resolved. Removed transfer borrow position function

## [H] GLP whole-position transfers leave redemption and remediation rights on the source vault

Resolved. We removed the transfer borrrow position function. Also, the redemption and remediation rights were only used when the GLP market was paused after the hack. 

## [M] Arbitrum liquidator wrapper discards available account-level risk overrides

Disputed. I think there is a misunderstanding, those functions do not exist on the Arbitrum implementation.

## [M] Debt migration bypasses the oracle-sentinel borrow freeze

Acknowledged. We cannot change this on V1 as it is immutable, but we will fix on our V2 implementation that is currently in development.

## [M] Expiry liquidations bypass the oracle-sentinel liquidation freeze

Acknowledged.

## [M] Vaporize bypasses the oracle-sentinel liquidation freeze

Acknowledged. We cannot change this on V1 but will fix on V2

## [M] Symmetric half-up par/wei conversions let users amplify and extract dust

Acknowledged. We cannot change this on V1 but will fix on V2

## [M] Unsettled interest-parameter updates retroactively reprice accrued interest

Acknowledged. We cannot change this on V1 but will fix on V2

## [M] ChainlinkPriceOracleV1 uses a single global stalenessThreshold for every feed, masking stale prices on faster-heartbeat feeds

Acknowledged

## [M] callInternalBalanceChangeIfNecessary is only invoked from Transfer, Trade, and Liquidate/Vaporize — Deposit, Withdraw, Buy, and Sell skip the callback, letting an operator mutate a contract-owned account’s balance without notifying it

Acknowledged. We are looking to deprecate the callback

## [L] Sticky Liquid status permits continued liquidation after full price recovery

Acknowledged/Disputed. Liquidations can only be performed by global operators. All liquidation global operators check the collateralization of the liquid account, but we will update this for V2 to be in the core code.

## [L] DepositWithdrawalRouter is incompatible with transfer-token override markets

Resolved. This feature was never actually used and we will fully deprecate.

## [L] Smart contract wallet callbacks add bounded gas griefing vector to liquidation

Resolved, set callback gas limit to 0 on non arbitrum networks. On Arbitrum, resolved via InternalTradeLiquidator.

## [L] Oracle sentinel gates all liquidation paths with no time-bounded fallback

Acknowledged

## [L] Isolation-mode other-token withdrawals ignore the documented withdraw-all sentinel

Resolved

## [L] E-mode risk overrides bypass per-market margin premiums, enabling over-leverage on volatile assets

Acknowledged. This is intentional so we can set accurate LTVs for e-mode categories.

## [L] Partial liquidation can leave dust below minBorrowedValue, locking the owner out of all primary operations

Acknowledged

## [L] Borrow-position transfers strip expiry metadata and defeat forced maturities

Resolved. Removed borrow position transfer function