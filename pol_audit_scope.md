# POL Audit

## Overview

Isolation mode is a main feature of Dolomite. Essentially, a user transfers a token to the isolation mode token vault and the isolation mode vault factory mints tokens to DolomiteMargin on behalf of the vault. Further details can be seen on the Whimsical charts.

DTokens are an ERC4626 wrapper around a user's Dolomite balance. If a user deposits 100 USDC into Dolomite, their Wei balance will be 100, but their Par balance will be something smaller than that. Par balances never change, but Wei balances increase as a user accrues interest.

Through proof of liquidity, users can stake their dTokens in a number of different POL providers such as Infrared, BGTM, and BGT. We are providing a product where users can transfer their balance in Dolomite to a POLIsolationModeVault and then stake through those different providers. This first iteration that is being audited will only include Infrared.

## Further details

https://whimsical.com/dolomite-FmrtMPavW4utveCU6dbjb

Detailed call flows can be seen on the whimsical charts linked above.

## Scope

packages/berachain/contracts/*
packages/base/proxies/GenericTraderProxy.sol (only the call from the vault to the generic trader proxies)

## Some ideas of where I would look for bugs

* Because wrapping requires two actions, an internal trade and sell, we need to ensure that the balance that we store between the two actions cannot be changed in any way and is always correct for the respective user.

* The user should not be able to only trigger one of the actions and maliciously alter their balance in a direction that favors the user.

* We charge fees on unwrapping that consists of two steps:
    - Call `metavault.chargeDTokenFee()` which will send dTokens from the metavault to the feeAgent
    - Call `withdrawFromDolomiteMargin()` to decrease the user's polDToken balance by the same amount as the fee

    Ensure that the polDToken balance of the vault is ALWAYS equal to the amount of dTokens that the metavault has control over which does include any amount staked in POL because it can be withdrawn if needed.

* A malicious user or vault owner should not be able to invoke an internal trade on the wrapper/unwrapper that results in incorrect movement of funds. This could be attempted by directly calling `DolomiteMargin.operate()` or by going through a vault. I'm thinking of potentially malicious user makes vault and invokes a trade using a different user's metavault