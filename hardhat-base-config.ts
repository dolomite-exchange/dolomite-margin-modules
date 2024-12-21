/* eslint-disable import/no-extraneous-dependencies */
import '@nomiclabs/hardhat-etherscan';
import '@typechain/hardhat';
import 'hardhat-gas-reporter';
import {
  Network,
  NETWORK_TO_DEFAULT_BLOCK_NUMBER_MAP,
  NetworkName,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import dotenv from 'dotenv';
import { HardhatUserConfig } from 'hardhat/types';
import 'tsconfig-paths/register';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

// RPC URLs
const mainnetWeb3Url = process.env.MAINNET_WEB3_PROVIDER_URL;
if (!mainnetWeb3Url) {
  throw new Error('No MAINNET_WEB3_PROVIDER_URL provided!');
}
const arbitrumOneWeb3Url = process.env.ARBITRUM_ONE_WEB3_PROVIDER_URL;
if (!arbitrumOneWeb3Url) {
  throw new Error('No ARBITRUM_ONE_WEB3_PROVIDER_URL provided!');
}
const baseWeb3Url = process.env.BASE_WEB3_PROVIDER_URL;
if (!baseWeb3Url) {
  throw new Error('No BASE_WEB3_PROVIDER_URL provided!');
}
const berachainWeb3Url = process.env.BERACHAIN_WEB3_PROVIDER_URL;
if (!berachainWeb3Url) {
  throw new Error('No BERACHAIN_WEB3_PROVIDER_URL provided!');
}
const berachainCartioWeb3Url = process.env.BERACHAIN_CARTIO_WEB3_PROVIDER_URL;
if (!berachainWeb3Url) {
  throw new Error('No BERACHAIN_CARTIO_WEB3_PROVIDER_URL provided!');
}
const inkWeb3Url = process.env.INK_WEB3_PROVIDER_URL;
if (!inkWeb3Url) {
  throw new Error('No INK_WEB3_PROVIDER_URL provided!');
}
const mantleWeb3Url = process.env.MANTLE_WEB3_PROVIDER_URL;
if (!mantleWeb3Url) {
  throw new Error('No MANTLE_WEB3_PROVIDER_URL provided!');
}
const polygonZkEvmWeb3Url = process.env.POLYGON_ZKEVM_WEB3_PROVIDER_URL;
if (!polygonZkEvmWeb3Url) {
  throw new Error('No POLYGON_ZKEVM_WEB3_PROVIDER_URL provided!');
}
const superSeedWeb3Url = process.env.SUPER_SEED_WEB3_PROVIDER_URL;
if (!superSeedWeb3Url) {
  throw new Error('No SUPER_SEED_WEB3_PROVIDER_URL provided!');
}
const xLayerWeb3Url = process.env.X_LAYER_WEB3_PROVIDER_URL;
if (!xLayerWeb3Url) {
  throw new Error('No X_LAYER_WEB3_PROVIDER_URL provided!');
}

// Blcok Explorer API Keys
const arbiscanApiKey = process.env.ARBISCAN_API_KEY;
if (!arbiscanApiKey) {
  throw new Error('No ARBISCAN_API_KEY provided!');
}
const basescanApiKey = process.env.BASESCAN_API_KEY;
if (!basescanApiKey) {
  throw new Error('No BASESCAN_API_KEY provided!');
}
const berascanApiKey = process.env.BERASCAN_API_KEY;
if (!berascanApiKey) {
  throw new Error('No BERASCAN_API_KEY provided!');
}
const inkscanApiKey = process.env.INKSCAN_API_KEY;
if (!inkscanApiKey) {
  throw new Error('No INKSCAN_API_KEY provided!');
}
const mantlescanApiKey = process.env.MANTLESCAN_API_KEY;
if (!mantlescanApiKey) {
  throw new Error('No MANTLESCAN_API_KEY provided!');
}
const polygonscanApiKey = process.env.POLYGONSCAN_API_KEY;
if (!polygonscanApiKey) {
  throw new Error('No POLYGONSCAN_API_KEY provided!');
}
const superscanApiKey = process.env.SUPERSCAN_API_KEY;
if (!superscanApiKey) {
  throw new Error('No POLYGONSCAN_API_KEY provided!');
}
const xLayerApiKey = process.env.X_LAYER_API_KEY;
if (!xLayerApiKey) {
  throw new Error('No X_LAYER_API_KEY provided!');
}

const contractsDirectory = process.env.COVERAGE === 'true' ? './contracts_coverage' : './contracts';
export const base_config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      gas: 50_000_000,
      blockGasLimit: 100000000429720,
      chainId: parseInt(Network.PolygonZkEvm, 10),
      chains: {
        [Network.PolygonZkEvm]: {
          hardforkHistory: {
            berlin: NETWORK_TO_DEFAULT_BLOCK_NUMBER_MAP[Network.PolygonZkEvm] - 1,
          },
        },
      },
    },
    mainnet: {
      chainId: 1,
      url: mainnetWeb3Url,
      gas: 30_000_000, // 30M gas
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    [NetworkName.ArbitrumOne]: {
      chainId: parseInt(Network.ArbitrumOne, 10),
      url: arbitrumOneWeb3Url,
      gas: 30_000_000, // 30M gas
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    [NetworkName.Base]: {
      chainId: parseInt(Network.Base, 10),
      url: baseWeb3Url,
      gas: 20_000_000, // 20M gas
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    [NetworkName.Berachain]: {
      chainId: parseInt(Network.Berachain, 10),
      url: berachainWeb3Url,
      gas: 20_000_000, // 20M gas
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    [NetworkName.BerachainCartio]: {
      chainId: parseInt(Network.BerachainCartio, 10),
      url: berachainCartioWeb3Url,
      gas: 20_000_000, // 20M gas
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    [NetworkName.Ink]: {
      chainId: parseInt(Network.Ink, 10),
      url: inkWeb3Url,
      gas: 30_000_000, // 30M gas
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    [NetworkName.Mantle]: {
      chainId: parseInt(Network.Mantle, 10),
      url: mantleWeb3Url,
      gas: 25_000_000_000, // 25B gas
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    [NetworkName.PolygonZkEvm]: {
      chainId: parseInt(Network.PolygonZkEvm, 10),
      url: polygonZkEvmWeb3Url,
      gas: 20_000_000, // 20M gas
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    [NetworkName.SuperSeed]: {
      chainId: parseInt(Network.SuperSeed, 10),
      url: superSeedWeb3Url,
      gas: 30_000_000, // 30M gas
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    [NetworkName.XLayer]: {
      chainId: parseInt(Network.XLayer, 10),
      url: xLayerWeb3Url,
      gas: 25_000_000, // 25M gas
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
      [NetworkName.ArbitrumOne]: arbiscanApiKey,
      [NetworkName.Base]: basescanApiKey,
      [NetworkName.Berachain]: berascanApiKey,
      [NetworkName.BerachainCartio]: berascanApiKey,
      [NetworkName.Ink]: inkscanApiKey,
      [NetworkName.Mantle]: mantlescanApiKey,
      [NetworkName.PolygonZkEvm]: polygonscanApiKey,
      [NetworkName.SuperSeed]: superscanApiKey,
      [NetworkName.XLayer]: xLayerApiKey,
    },
    customChains: [
      {
        network: NetworkName.ArbitrumOne,
        chainId: parseInt(Network.ArbitrumOne, 10),
        urls: {
          apiURL: 'https://api.arbiscan.io/api',
          browserURL: 'https://arbiscan.io',
        },
      },
      {
        network: NetworkName.Base,
        chainId: parseInt(Network.Base, 10),
        urls: {
          apiURL: 'https://api.basescan.org/api',
          browserURL: 'https://basescan.org/',
        },
      },
      {
        network: NetworkName.Berachain,
        chainId: parseInt(Network.Berachain, 10),
        urls: {
          apiURL: 'https://api.routescan.io/v2/network/testnet/evm/80084/etherscan/api',
          browserURL: 'https://bartio.beratrail.io/address',
        },
      },
      {
        network: NetworkName.BerachainCartio,
        chainId: parseInt(Network.BerachainCartio, 10),
        urls: {
          apiURL: 'https://api.routescan.io/v2/network/testnet/evm/80000/etherscan/api',
          browserURL: 'https://80000.testnet.routescan.io',
        },
      },
      {
        network: NetworkName.Ink,
        chainId: parseInt(Network.Ink, 10),
        urls: {
          apiURL: 'https://explorer.inkonchain.com/api',
          browserURL: 'https://explorer.inkonchain.com',
        },
      },
      {
        network: NetworkName.Mantle,
        chainId: parseInt(Network.Mantle, 10),
        urls: {
          apiURL: 'https://api.mantlescan.xyz/api',
          browserURL: 'https://mantlescan.xyz',
        },
      },
      {
        network: NetworkName.PolygonZkEvm,
        chainId: parseInt(Network.PolygonZkEvm, 10),
        urls: {
          apiURL: 'https://api-zkevm.polygonscan.com/api',
          browserURL: 'https://zkevm.polygonscan.com',
        },
      },
      {
        network: NetworkName.SuperSeed,
        chainId: parseInt(Network.SuperSeed, 10),
        urls: {
          apiURL: 'https://explorer.superseed.xyz/api',
          browserURL: 'https://explorer.superseed.xyz',
        },
      },
      {
        network: NetworkName.XLayer,
        chainId: parseInt(Network.XLayer, 10),
        urls: {
          apiURL: 'https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/XLAYER',
          browserURL: 'https://www.oklink.com/xlayer/',
        },
      },
    ],
  },
  tracer: {
    tasks: ['run'],
  }
};
