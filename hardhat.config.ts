/* eslint-disable import/no-extraneous-dependencies */
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-solhint';
import '@nomiclabs/hardhat-vyper';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import 'hardhat-gas-reporter';
import 'solidity-coverage';

import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import { HardhatUserConfig } from 'hardhat/types';
import { DEFAULT_BLOCK_NUMBER } from './src/utils/no-deps-constants';

import 'tsconfig-paths/register';

chai.use(solidity);
require('dotenv').config();

const arbitrumOneWeb3Url = process.env.ARBITRUM_ONE_WEB3_PROVIDER_URL;
if (!arbitrumOneWeb3Url) {
  throw new Error('No ARBITRUM_ONE_WEB3_PROVIDER_URL provided!');
}
const arbitrumGoerliWeb3Url = process.env.ARBITRUM_GOERLI_WEB3_PROVIDER_URL;
if (!arbitrumGoerliWeb3Url) {
  throw new Error('No ARBITRUM_GOERLI_WEB3_PROVIDER_URL provided!');
}
const arbiscanApiKey = process.env.ARBISCAN_API_KEY;
if (!arbiscanApiKey) {
  throw new Error('No ARBISCAN_API_KEY provided!');
}

export const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      forking: {
        url: arbitrumOneWeb3Url,
        blockNumber: DEFAULT_BLOCK_NUMBER,
      },
    },
    arbitrum_one: {
      chainId: 42161,
      url: arbitrumOneWeb3Url,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    arbitrum_goerli: {
      chainId: 421613,
      url: arbitrumGoerliWeb3Url,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
  },
  solidity: {
    compilers: [
      {
        version: '0.8.9',
        settings: {
          optimizer: {
            enabled: true,
            runs: 10000,
            details: {
              yul: false, // set this to false to fix some extraneous "stack too deep" errors that don't make sense
            },
          },
        },
      },
    ],
  },
  mocha: {
    timeout: 2000000,
  },
  typechain: {
    outDir: 'src/types',
    target: 'ethers-v5',
    alwaysGenerateOverloads: false,
    externalArtifacts: [
      'node_modules/@dolomite-exchange/dolomite-margin/build/contracts/*.json',
      'node_modules/@openzeppelin/contracts/build/contracts/*.json',
    ],
  },
  etherscan: {
    apiKey: {
      arbitrumOne: arbiscanApiKey,
      arbitrumGoerli: arbiscanApiKey,
    },
  },
};

// noinspection JSUnusedGlobalSymbols
export default config;
