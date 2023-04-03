<p align="center">
<img src="./dolomite-logo.png" width="256" />
</p>

<div align="center">
  <a href='https://coveralls.io/github/dolomite-exchange/dolomite-margin-modules?branch=master'>
    <img src='https://coveralls.io/repos/github/dolomite-exchange/dolomite-margin-modules/badge.svg?branch=master&longCache=false' alt='Coverage Status' />
  </a>
  <a href='https://github.com/dolomite-exchange/dolomite-margin-modules/blob/master/LICENSE' style="text-decoration:none;">
    <img src='https://img.shields.io/badge/GPL--2.0-llicense-red?longCache=true' alt='License' />
  </a>
  <a href='https://discord.com/invite/uDRzrB2YgP' style="text-decoration:none;">
    <img src='https://img.shields.io/badge/chat-on%20discord-7289DA.svg?longCache=true' alt='Discord' />
  </a>
  <a href='https://t.me/dolomite_official' style="text-decoration:none;">
    <img src='https://img.shields.io/badge/chat-on%20telegram-9cf.svg?longCache=true' alt='Telegram' />
  </a>
  <a href='https://github.com/dolomite-exchange/dolomite-margin-modules' style="text-decoration:none;">
    <img src='https://img.shields.io/badge/GitHub-dolomite--exchange%2Fdolomite--margin--modules-lightgrey' alt='GitHub'/>
  </a>
</div>

> Solidity Smart Contracts for integration tests against the live `DolomiteMargin` instance on Arbitrum One for
> testing new modules against the live deployment.

## Installation

1. Run `yarn install` to install the rest of the dependencies.
2. Sign up on [Infura](https://infura.io/register) or [Alchemy](https://www.alchemy.com/). We recommend using Infura or
   Alchemy to allow for a reproducible Arbitrum One testing environment as well as efficiency due to caching.
3. Run `yarn build` to compile all smart contracts and build TypeChain wrappers

## Testing

1. To run all tests, run `yarn test`
