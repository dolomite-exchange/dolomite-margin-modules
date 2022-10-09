/* eslint-disable import/no-extraneous-dependencies */
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import "@nomiclabs/hardhat-vyper";
import '@typechain/hardhat';
import 'hardhat-gas-reporter';

import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import { HardhatUserConfig } from 'hardhat/types';
import { DefaultBlockNumber } from './src/utils/no-deps-constants';

chai.use(solidity);
require('dotenv').config()

const infuraApiKey = process.env.INFURA_API_KEY;
if (!infuraApiKey) {
  throw new Error('No INFURA_API_KEY provided!');
}

export const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      forking: {
        url: `https://arbitrum-mainnet.infura.io/v3/${infuraApiKey}`,
        blockNumber: DefaultBlockNumber,
        ignoreUnknownTxType: true,
      }
    },
    arbitrum: {
      url: `https://arbitrum-mainnet.infura.io/v3/${infuraApiKey}`,
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
    externalArtifacts: ['externalArtifacts/*.json'],
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

// noinspection JSUnusedGlobalSymbols
export default config;
