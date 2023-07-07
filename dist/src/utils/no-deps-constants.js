"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NO_PARASWAP_TRADER_PARAM = exports.SELL_ALL = exports.LIQUIDATE_ALL = exports.MAX_UINT_256_BI = exports.TEN_BI = exports.ONE_BI = exports.ZERO_BI = exports.BYTES_ZERO = exports.BYTES_EMPTY = exports.ONE_WEEK_SECONDS = exports.DEFAULT_BLOCK_NUMBER = exports.NETWORK_TO_DEFAULT_BLOCK_NUMBER_MAP = exports.NONE_MARKET_ID = exports.NO_EXPIRY = exports.NETWORK_ID = exports.networkToNetworkNameMap = exports.NetworkName = exports.Network = void 0;
const ethers_1 = require("ethers");
// ************************* General Constants *************************
var Network;
(function (Network) {
    Network["ArbitrumOne"] = "42161";
    Network["ArbitrumGoerli"] = "421613";
})(Network = exports.Network || (exports.Network = {}));
var NetworkName;
(function (NetworkName) {
    NetworkName["ArbitrumOne"] = "arbitrum_one";
    NetworkName["ArbitrumGoerli"] = "arbitrum_goerli";
})(NetworkName = exports.NetworkName || (exports.NetworkName = {}));
exports.networkToNetworkNameMap = {
    [Network.ArbitrumOne]: NetworkName.ArbitrumOne,
    [Network.ArbitrumGoerli]: NetworkName.ArbitrumGoerli,
};
const typedNetworkIdString = process.env.NETWORK_ID || Network.ArbitrumOne;
exports.NETWORK_ID = Network[typedNetworkIdString] || Network.ArbitrumOne;
exports.NO_EXPIRY = ethers_1.BigNumber.from('0');
exports.NONE_MARKET_ID = ethers_1.ethers.constants.MaxUint256;
exports.NETWORK_TO_DEFAULT_BLOCK_NUMBER_MAP = {
    [Network.ArbitrumOne]: 107511000,
    [Network.ArbitrumGoerli]: 14700000,
};
exports.DEFAULT_BLOCK_NUMBER = exports.NETWORK_TO_DEFAULT_BLOCK_NUMBER_MAP[exports.NETWORK_ID];
exports.ONE_WEEK_SECONDS = 604800;
exports.BYTES_EMPTY = '0x';
exports.BYTES_ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000';
exports.ZERO_BI = ethers_1.BigNumber.from('0');
exports.ONE_BI = ethers_1.BigNumber.from('1');
exports.TEN_BI = ethers_1.BigNumber.from('10');
exports.MAX_UINT_256_BI = ethers_1.BigNumber.from('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
exports.LIQUIDATE_ALL = exports.MAX_UINT_256_BI;
exports.SELL_ALL = exports.MAX_UINT_256_BI;
exports.NO_PARASWAP_TRADER_PARAM = undefined;
