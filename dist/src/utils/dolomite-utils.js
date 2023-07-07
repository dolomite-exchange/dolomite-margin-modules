"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.heldWeiToOwedWei = exports.owedWeiToHeldWei = exports.getPartialRoundHalfUp = exports.getPartialRoundUp = exports.getPartial = exports.valueStructToBigNumber = exports.withdrawFromDolomiteMargin = exports.depositIntoDolomiteMargin = exports.createWithdrawAction = exports.createDepositAction = exports.createTestVaultToken = exports.createTestToken = exports.createContractWithAbi = exports.createContract = void 0;
const src_1 = require("@dolomite-margin/dist/src");
const ethers_1 = require("ethers");
const hardhat_1 = require("hardhat");
const types_1 = require("../types");
/**
 * @return  The deployed contract
 */
async function createContract(contractName, args) {
    const ContractFactory = await hardhat_1.ethers.getContractFactory(contractName);
    return await ContractFactory.deploy(...args);
}
exports.createContract = createContract;
async function createContractWithAbi(abi, bytecode, args) {
    const ContractFactory = await hardhat_1.ethers.getContractFactory(abi, bytecode);
    return await ContractFactory.deploy(...args);
}
exports.createContractWithAbi = createContractWithAbi;
async function createTestToken() {
    return createContractWithAbi(types_1.CustomTestToken__factory.abi, types_1.CustomTestToken__factory.bytecode, ['Test Token', 'TEST', 18]);
}
exports.createTestToken = createTestToken;
async function createTestVaultToken(asset) {
    return createContractWithAbi(types_1.CustomTestVaultToken__factory.abi, types_1.CustomTestVaultToken__factory.bytecode, [asset.address, 'Test Vault Token', 'TEST', 18]);
}
exports.createTestVaultToken = createTestVaultToken;
function createDepositAction(amount, tokenId, accountOwner, fromAddress) {
    return {
        actionType: src_1.ActionType.Deposit,
        accountId: '0',
        amount: {
            sign: true,
            denomination: src_1.AmountDenomination.Wei,
            ref: src_1.AmountReference.Delta,
            value: amount,
        },
        primaryMarketId: tokenId,
        secondaryMarketId: 0,
        otherAddress: fromAddress !== null && fromAddress !== void 0 ? fromAddress : accountOwner.address,
        otherAccountId: 0,
        data: '0x',
    };
}
exports.createDepositAction = createDepositAction;
function createWithdrawAction(amount, tokenId, accountOwner, toAddress) {
    return {
        actionType: src_1.ActionType.Withdraw,
        accountId: '0',
        amount: {
            sign: false,
            denomination: src_1.AmountDenomination.Wei,
            ref: src_1.AmountReference.Delta,
            value: amount,
        },
        primaryMarketId: tokenId,
        secondaryMarketId: 0,
        otherAddress: toAddress !== null && toAddress !== void 0 ? toAddress : accountOwner.address,
        otherAccountId: 0,
        data: '0x',
    };
}
exports.createWithdrawAction = createWithdrawAction;
async function depositIntoDolomiteMargin(core, accountOwner, accountNumber, tokenId, amount, fromAddress) {
    await core.dolomiteMargin
        .connect(accountOwner)
        .operate([{ owner: accountOwner.address, number: accountNumber }], [createDepositAction(amount, tokenId, accountOwner, fromAddress)]);
}
exports.depositIntoDolomiteMargin = depositIntoDolomiteMargin;
async function withdrawFromDolomiteMargin(core, user, accountId, tokenId, amount, toAddress) {
    await core.dolomiteMargin
        .connect(user)
        .operate([{ owner: user.address, number: accountId }], [createWithdrawAction(amount, tokenId, user, toAddress)]);
}
exports.withdrawFromDolomiteMargin = withdrawFromDolomiteMargin;
function valueStructToBigNumber(valueStruct) {
    return ethers_1.BigNumber.from(valueStruct.sign ? valueStruct.value : valueStruct.value.mul(-1));
}
exports.valueStructToBigNumber = valueStructToBigNumber;
function getPartial(amount, numerator, denominator) {
    return amount.mul(numerator).div(denominator);
}
exports.getPartial = getPartial;
function getPartialRoundUp(target, numerator, denominator) {
    return target.mul(numerator).sub(1).div(denominator).add(1);
}
exports.getPartialRoundUp = getPartialRoundUp;
function getPartialRoundHalfUp(target, numerator, denominator) {
    return target.mul(numerator).add(denominator.div(2)).div(denominator);
}
exports.getPartialRoundHalfUp = getPartialRoundHalfUp;
function owedWeiToHeldWei(owedWei, owedPrice, heldPrice) {
    return getPartial(owedWei, owedPrice, heldPrice);
}
exports.owedWeiToHeldWei = owedWeiToHeldWei;
function heldWeiToOwedWei(heldWei, heldPrice, owedPrice) {
    return getPartialRoundUp(heldWei, heldPrice, owedPrice);
}
exports.heldWeiToOwedWei = heldWeiToOwedWei;
