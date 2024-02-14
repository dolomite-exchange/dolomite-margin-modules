/* eslint-disable import/no-extraneous-dependencies */
import '@nomiclabs/hardhat-etherscan';
import '@typechain/hardhat';
import 'hardhat-gas-reporter';
import {
  DEFAULT_BLOCK_NUMBER,
  Network,
  NetworkName,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { HardhatUserConfig } from 'hardhat/types';

import 'tsconfig-paths/register';

import path from 'path';

require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const arbitrumOneWeb3Url = process.env.ARBITRUM_ONE_WEB3_PROVIDER_URL;
if (!arbitrumOneWeb3Url) {
  throw new Error('No ARBITRUM_ONE_WEB3_PROVIDER_URL provided!');
}
const baseWeb3Url = process.env.BASE_WEB3_PROVIDER_URL;
if (!baseWeb3Url) {
  throw new Error('No BASE_WEB3_PROVIDER_URL provided!');
}
const polygonZkEvmWeb3Url = process.env.POLYGON_ZKEVM_WEB3_PROVIDER_URL;
if (!polygonZkEvmWeb3Url) {
  throw new Error('No POLYGON_ZKEVM_WEB3_PROVIDER_URL provided!');
}
const arbiscanApiKey = process.env.ARBISCAN_API_KEY;
if (!arbiscanApiKey) {
  throw new Error('No ARBISCAN_API_KEY provided!');
}
const basescanApiKey = process.env.BASESCAN_API_KEY;
if (!basescanApiKey) {
  throw new Error('No BASESCAN_API_KEY provided!');
}
const polygonscanApiKey = process.env.POLYGONSCAN_API_KEY;
if (!polygonscanApiKey) {
  throw new Error('No POLYGONSCAN_API_KEY provided!');
}

const contractsDirectory = process.env.COVERAGE === 'true' ? './contracts_coverage' : './contracts';
const config: HardhatUserConfig = {
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
      chainId: parseInt(Network.ArbitrumOne, 10),
      url: arbitrumOneWeb3Url,
      gas: 30_000_000, // 50M gas
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    [NetworkName.Base]: {
      chainId: parseInt(Network.Base, 10),
      url: baseWeb3Url,
      gas: 20_000_000, // 20M gas
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    [NetworkName.PolygonZkEvm]: {
      chainId: parseInt(Network.PolygonZkEvm, 10),
      url: polygonZkEvmWeb3Url,
      gas: 20_000_000, // 20M gas
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
    // retries: process.env.COVERAGE === 'true' ? 2 : 0,
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
      base: basescanApiKey,
      polygonZkEvm: polygonscanApiKey,
    },
  },
};

export default config;
