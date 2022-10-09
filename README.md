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
</div>

> Ethereum Smart Contracts for integration tests against the live `DolomiteMargin` instance on Arbitrum One for
testing new modules against the live deployment.

## Installation

1. Clone [Dolomite's Hardhat Fork for Arbitrum](https://github.com/dolomite-exchange/hardhat) into another directory.
This repository depends on it because the default Hardhat NPM library does not support forking Arbitrum One. This is
because of the lack of support for custom transaction types. See more information 
[here](https://github.com/NomicFoundation/hardhat/pull/3260). 
2. Run `yarn install && yarn build && npm link` from within the forked `hardhat` project's working directory.
3. Switch back to this project's working directory and run `npm link hardhat`. This will link the forked `hardhat` 
project to this project's `node_modules` directory. 
4. Run `yarn install` to install the rest of the dependencies.
5. Sign up on [Infura](https://infura.io/register). We recommend using Infura to allow for a reproducible Arbitrum One
   testing environment as well as efficiency due to caching.
6. Run `yarn build` to compile all smart contracts and build TypeChain wrappers

## Testing

1. To run all tests, run `yarn test`
