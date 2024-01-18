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
import path from 'path';
import 'solidity-coverage';

import 'tsconfig-paths/register';
import { DEFAULT_BLOCK_NUMBER, NetworkName } from './src/utils/no-deps-constants';

chai.use(solidity);
require('dotenv').config({ path: path.resolve(process.cwd(), '../../.env') });
if (process.env.COVERAGE !== 'true') {
  require('hardhat-tracer');
}

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
      allowUnlimitedContractSize: true,
      gas: 50_000_000,
      blockGasLimit: 100000000429720,
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
            runs: 200,
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
    // parallel: process.env.TEST_SPECIFIC !== 'true',
    // jobs: 2,
    slow: 60000,
    asyncOnly: true,
    retries: process.env.COVERAGE === 'true' ? 2 : 0,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
  },
  typechain: {
    outDir: 'src/types',
    target: 'ethers-v5',
    alwaysGenerateOverloads: false,
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
