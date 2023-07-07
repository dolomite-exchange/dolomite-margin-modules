"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEther = exports.waitHours = exports.waitDays = exports.waitTime = exports.advanceNBlock = exports.printGasLog = exports.gasLog = exports.impersonateAll = exports.impersonate = exports.impersonateOrFallback = exports.setEtherBalance = exports.revertToSnapshotAndCapture = exports.getBlockTimestamp = exports.getLatestBlockNumber = exports.snapshot = exports.resetFork = exports.getRealLatestBlockNumber = exports.increaseToTimestamp = void 0;
const hardhat_network_helpers_1 = require("@nomicfoundation/hardhat-network-helpers");
const ethers_1 = require("ethers");
const hardhat_1 = require("hardhat");
const no_deps_constants_1 = require("src/utils/no-deps-constants");
const gasLogger = {};
const gasLoggerNumberOfCalls = {};
async function increaseToTimestamp(timestamp) {
    await hardhat_network_helpers_1.time.increaseTo(timestamp);
}
exports.increaseToTimestamp = increaseToTimestamp;
/**
 * Gets the most recent block number from the real network, NOT the forked network.
 * @param include32BlockBuffer Hardhat works better when there's > 31 block confirmations
 * @param network The network to get the latest block number from
 */
async function getRealLatestBlockNumber(include32BlockBuffer, network) {
    var _a;
    const networkConfig = (_a = hardhat_1.config === null || hardhat_1.config === void 0 ? void 0 : hardhat_1.config.networks) === null || _a === void 0 ? void 0 : _a[no_deps_constants_1.networkToNetworkNameMap[network]];
    const provider = new hardhat_1.ethers.providers.JsonRpcProvider(networkConfig.url);
    const blockNumber = await provider.send('eth_blockNumber', []);
    return Number.parseInt(blockNumber, 16) - (include32BlockBuffer ? 32 : 0);
}
exports.getRealLatestBlockNumber = getRealLatestBlockNumber;
async function resetFork(blockNumber, network) {
    var _a;
    const networkConfig = (_a = hardhat_1.config.networks) === null || _a === void 0 ? void 0 : _a[no_deps_constants_1.networkToNetworkNameMap[network]];
    await hardhat_1.network.provider.request({
        method: 'hardhat_reset',
        params: [
            {
                forking: {
                    blockNumber,
                    jsonRpcUrl: networkConfig.url,
                },
            },
        ],
    });
}
exports.resetFork = resetFork;
/**
 * Note, snapshots can only be used once. Meaning, a new snapshot must be taken right after a reversion to ensure
 * a reversion can occur again in the future.
 *
 * @return The new snapshot ID of the chain
 */
async function snapshot() {
    const result = await hardhat_1.network.provider.request({
        method: 'evm_snapshot',
        params: [],
    });
    return result;
}
exports.snapshot = snapshot;
async function getLatestBlockNumber() {
    const block = await hardhat_1.network.provider.request({
        method: 'eth_getBlockByNumber',
        params: ['latest', false],
    });
    return Number.parseInt(block.number, 16);
}
exports.getLatestBlockNumber = getLatestBlockNumber;
async function getBlockTimestamp(blockNumber) {
    const block = await hardhat_1.network.provider.request({
        method: 'eth_getBlockByNumber',
        params: [`0x${blockNumber.toString(16)}`, false],
    });
    return Number.parseInt(block.timestamp, 16);
}
exports.getBlockTimestamp = getBlockTimestamp;
/**
 * Note, snapshots can only be used once. Meaning, a new snapshot must be taken right after a reversion to ensure
 * a reversion can occur again in the future.
 *
 * @param snapshotId The snapshot point at which the chain will be reverted.
 * @return The new snapshot that was taken right after the reversion or the previous ID if a reversion did not occur.
 */
async function revertToSnapshotAndCapture(snapshotId) {
    const id = await snapshot();
    if (id !== snapshotId) {
        await hardhat_1.network.provider.request({
            method: 'evm_revert',
            params: [snapshotId],
        });
        return snapshot();
    }
    return id;
}
exports.revertToSnapshotAndCapture = revertToSnapshotAndCapture;
async function setEtherBalance(address, balance = '1000000000000000000') {
    await hardhat_1.network.provider.send('hardhat_setBalance', [
        address,
        `0x${hardhat_1.ethers.BigNumber.from(balance).toBigInt().toString(16)}`,
    ]);
}
exports.setEtherBalance = setEtherBalance;
async function impersonateOrFallback(targetAccount, giveEther, fallbackSigner) {
    if (hardhat_1.network.name !== 'hardhat') {
        return fallbackSigner;
    }
    return impersonate(targetAccount, giveEther);
}
exports.impersonateOrFallback = impersonateOrFallback;
async function impersonate(targetAccount, giveEther = false, balance = ethers_1.BigNumber.from('1000000000000000000')) {
    await hardhat_1.network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [targetAccount],
    });
    if (giveEther) {
        await setEtherBalance(targetAccount, balance);
    }
    return hardhat_1.ethers.getSigner(targetAccount);
}
exports.impersonate = impersonate;
async function impersonateAll(targetAccounts, giveEther = false) {
    const signers = [];
    for (let i = 0; i < targetAccounts.length; i++) {
        signers[i] = await impersonate(targetAccounts[i], giveEther);
    }
    return signers;
}
exports.impersonateAll = impersonateAll;
async function gasLog(logTo, transactionPromise) {
    const transaction = await transactionPromise;
    const gasUsed = (await hardhat_1.ethers.provider.getTransactionReceipt(transaction.hash)).gasUsed;
    if (typeof gasLogger[logTo] === 'undefined') {
        gasLogger[logTo] = gasUsed;
        gasLoggerNumberOfCalls[logTo] = 1;
    }
    else {
        const numberOfCalls = ++gasLoggerNumberOfCalls[logTo];
        gasLogger[logTo] = gasLogger[logTo].div(numberOfCalls).add(gasUsed.div(numberOfCalls));
    }
}
exports.gasLog = gasLog;
async function printGasLog() {
    console.log('\tGas used:', JSON.stringify(gasLogger, undefined, '\n'));
}
exports.printGasLog = printGasLog;
async function advanceNBlock(n, secondsPerBlock = 1) {
    await hardhat_1.ethers.provider.send('hardhat_mine', [`0x${n.toString(16)}`, `0x${secondsPerBlock.toString(16)}`]);
}
exports.advanceNBlock = advanceNBlock;
async function waitTime(timeToAddSeconds) {
    const currentTimestamp = await hardhat_1.ethers.provider.getBlock('latest');
    await hardhat_1.ethers.provider.send('evm_setNextBlockTimestamp', [currentTimestamp.timestamp + timeToAddSeconds]);
    await hardhat_1.ethers.provider.send('evm_mine', []);
}
exports.waitTime = waitTime;
async function waitDays(n) {
    await waitTime((n * 86400) + 1);
}
exports.waitDays = waitDays;
async function waitHours(n) {
    await waitTime(n * 3600 + 1);
}
exports.waitHours = waitHours;
async function sendEther(from, to, value) {
    await hardhat_1.network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [from],
    });
    const signer = await hardhat_1.ethers.getSigner(from);
    return signer.sendTransaction({
        from,
        to,
        value,
    });
}
exports.sendEther = sendEther;
