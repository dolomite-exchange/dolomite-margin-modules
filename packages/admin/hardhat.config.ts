/* eslint-disable import/no-extraneous-dependencies */
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-solhint';
import '@nomiclabs/hardhat-vyper';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';

import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import 'hardhat-gas-reporter';
import 'hardhat-tracer';
import 'solidity-coverage';

import 'tsconfig-paths/register';

import { base_config } from '../../hardhat-base-config';

chai.use(solidity);

// noinspection JSUnusedGlobalSymbols
export default base_config;
