# DolomiteMigrator

The `DolomiteMigrator` contract has 3 external functions: `migrate()`, `ownerSetTransformer` and `ownerSetHandler`.

In order to function properly, the `DolomiteMigrator` contract needs to be set as a global operator and as a trusted token converter on the factory of the `fromMarketId` and the `toMarketId`.

### migrate()

* This function accepts 4 parameters: a list of AccountInfos, the fromMarketId, the toMarketId, and any extra data that may be required for the transformer to execute properly.
* This function is reponsible for migrating each account's entire balance to the `toMarketId`.
* This function is only callable by the handler.

# IsolationModeMigrator

This is the contract that will replace the `IsolationModeTokenVault` implementation. This contract has two external functions: 

* `migrate()` is callable only by the migrator and will blindly transfer an amount of tokens to the migrator

* `executeWithdrawalFromVault` is required so the withdrawal operation can succeed on Dolomite, but this function is a No-Op.

# IDolomiteTransformer

The transformers are responsible for holding the logic that actually converts the tokens from the `fromMarketId` to the `toMarketId`. The transformer will receive a delegatecall from `DolomiteMigrator`. 

There are two requirements for this contract:
* It must have `address public immutable outputToken`. Some markets do not use the `VAULT_FACTORY.UNDERLYING_TOKEN()` and we need to be able to handle these markets as well.
* It must have the `transform` function which is responsible for actually converting the received tokens to the `outputToken`