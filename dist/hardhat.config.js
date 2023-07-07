"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
/* eslint-disable import/no-extraneous-dependencies */
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-solhint");
require("@nomiclabs/hardhat-vyper");
require("@nomiclabs/hardhat-waffle");
require("@typechain/hardhat");
const chai_1 = __importDefault(require("chai"));
const ethereum_waffle_1 = require("ethereum-waffle");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("tsconfig-paths/register");
const no_deps_constants_1 = require("./src/utils/no-deps-constants");
chai_1.default.use(ethereum_waffle_1.solidity);
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
exports.config = {
    defaultNetwork: 'hardhat',
    networks: {
        hardhat: {
            forking: {
                url: arbitrumOneWeb3Url,
                blockNumber: no_deps_constants_1.DEFAULT_BLOCK_NUMBER,
            },
        },
        [no_deps_constants_1.NetworkName.ArbitrumOne]: {
            chainId: 42161,
            url: arbitrumOneWeb3Url,
            gas: 50000000,
            accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
        },
        [no_deps_constants_1.NetworkName.ArbitrumGoerli]: {
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
exports.default = exports.config;
