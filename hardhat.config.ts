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
import { HardhatUserConfig } from 'hardhat/types';
import 'solidity-coverage';

import 'tsconfig-paths/register';
import { DEFAULT_BLOCK_NUMBER, NetworkName } from './src/utils/no-deps-constants';

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

const contractsDirectory = process.env.COVERAGE === 'true' ? './contracts_coverage' : './contracts';
export const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      forking: {
        url: arbitrumOneWeb3Url,
        blockNumber: DEFAULT_BLOCK_NUMBER,
      },
    },
    [NetworkName.ArbitrumOne]: {
      chainId: 42161,
      url: arbitrumOneWeb3Url,
      gas: 50_000_000, // 50M gas
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    [NetworkName.ArbitrumGoerli]: {
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
              yul: false, // To fix some extraneous "stack too deep" errors that don't make sense, set this to false.
            },
          },
        },
      },
    ],
  },
  paths: {
    sources: contractsDirectory,
  },
  mocha: {
    timeout: 2000000,
  },
  typechain: {
    outDir: 'src/types',
    target: 'ethers-v5',
    alwaysGenerateOverloads: false,
    // externalArtifacts: [
    //   'node_modules/@dolomite-exchange/dolomite-margin/build/contracts/*!(Multicall).json',
    //   'node_modules/@openzeppelin/contracts/build/contracts/*!(Multicall).json',
    // ],
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
