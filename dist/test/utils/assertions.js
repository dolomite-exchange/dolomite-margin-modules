"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expectArrayEq = exports.expectAssetAmountToEq = exports.expectTotalSupply = exports.expectWalletAllowance = exports.expectVaultBalanceToMatchAccountBalances = exports.expectWalletBalance = exports.expectProtocolBalanceDustyOrZero = exports.expectProtocolBalance = exports.expectEvent = exports.expectWalletBalanceOrDustyIfZero = exports.expectProtocolBalanceIsGreaterThan = exports.expectNoThrow = exports.expectThrowBalanceFlagError = exports.expectThrow = exports.expectThrowWithMatchingReason = void 0;
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const errors_1 = require("hardhat/internal/core/errors");
const types_1 = require("../../src/types");
const dolomite_utils_1 = require("../../src/utils/dolomite-utils");
const no_deps_constants_1 = require("../../src/utils/no-deps-constants");
async function expectThrowWithMatchingReason(call, reason) {
    if (reason) {
        await (0, chai_1.expect)(call).to.be.revertedWith(reason);
    }
    else {
        await (0, chai_1.expect)(call).to.be.reverted;
    }
}
exports.expectThrowWithMatchingReason = expectThrowWithMatchingReason;
async function expectThrow(call, reason) {
    if (reason) {
        await (0, chai_1.expect)(call).to.be.revertedWith(reason);
    }
    else {
        await (0, chai_1.expect)(call).to.be.reverted;
    }
}
exports.expectThrow = expectThrow;
async function expectThrowBalanceFlagError(call, accountOwner, accountNumber, marketId) {
    const ownerString = accountOwner.address.toLowerCase();
    const numberString = accountNumber.toString();
    const marketString = marketId.toString();
    await expectThrow(call, `AccountBalanceLib: account cannot go negative <${ownerString}, ${numberString}, ${marketString}>`);
}
exports.expectThrowBalanceFlagError = expectThrowBalanceFlagError;
async function expectNoThrow(call) {
    await (0, chai_1.expect)(call).not.to.be.reverted;
}
exports.expectNoThrow = expectNoThrow;
// ========================= Balance Assertions =========================
async function expectProtocolBalanceIsGreaterThan(coreProtocol, accountStruct, marketId, expectedBalance, marginOfErrorBps) {
    (0, errors_1.assertHardhatInvariant)(ethers_1.BigNumber.from(marginOfErrorBps).lte(10000), 'Margin of error must be less than 10000 bps');
    const expectedBalanceWithMarginOfError = ethers_1.BigNumber.from(expectedBalance)
        .sub(ethers_1.BigNumber.from(expectedBalance).mul(marginOfErrorBps).div('10000'));
    const balance = await coreProtocol.dolomiteMargin.getAccountWei(accountStruct, marketId);
    (0, chai_1.expect)((0, dolomite_utils_1.valueStructToBigNumber)(balance))
        .to
        .gte(expectedBalanceWithMarginOfError);
}
exports.expectProtocolBalanceIsGreaterThan = expectProtocolBalanceIsGreaterThan;
// const TEN_CENTS = BigNumber.from('100000000000000000000000000000000000'); // $1 eq 1e36. Take off 1 decimal
const ONE_CENT = ethers_1.BigNumber.from('10000000000000000000000000000000000'); // $1 eq 1e36. Take off 2 decimals
async function expectWalletBalanceOrDustyIfZero(coreProtocol, wallet, token, expectedBalance, balanceBefore) {
    const tokenContract = await types_1.ERC20__factory.connect(token, coreProtocol.hhUser1);
    let balance = await tokenContract.balanceOf(wallet);
    balance = balanceBefore ? balance.sub(balanceBefore) : balance;
    if (!balance.eq(expectedBalance) && ethers_1.BigNumber.from(expectedBalance).eq('0')) {
        // check the amount is dusty then (< $0.01)
        const price = await coreProtocol.dolomiteMargin.getMarketPrice(await coreProtocol.dolomiteMargin.getMarketIdByTokenAddress(token));
        const monetaryValue = price.value.mul(balance);
        (0, chai_1.expect)(monetaryValue).to.be.lt(ONE_CENT);
    }
    else {
        (0, chai_1.expect)(balance).to.eq(ethers_1.BigNumber.from(expectedBalance));
    }
}
exports.expectWalletBalanceOrDustyIfZero = expectWalletBalanceOrDustyIfZero;
async function expectEvent(contract, contractTransaction, eventName, args) {
    const argsArray = Object.values(args);
    if (argsArray.length > 0) {
        await (0, chai_1.expect)(contractTransaction).to.emit(contract, eventName).withArgs(...argsArray);
    }
    else {
        await (0, chai_1.expect)(contractTransaction).to.emit(contract, eventName);
    }
}
exports.expectEvent = expectEvent;
async function expectProtocolBalance(core, accountOwner, accountNumber, marketId, amountWei) {
    const account = {
        owner: typeof accountOwner === 'object' ? accountOwner.address : accountOwner,
        number: accountNumber,
    };
    const rawBalanceWei = await core.dolomiteMargin.getAccountWei(account, marketId);
    const balanceWei = rawBalanceWei.sign ? rawBalanceWei.value : rawBalanceWei.value.mul(-1);
    (0, chai_1.expect)(balanceWei).eq(amountWei);
}
exports.expectProtocolBalance = expectProtocolBalance;
async function expectProtocolBalanceDustyOrZero(core, accountOwner, accountNumber, marketId, maxDustyValueUsd = ONE_CENT) {
    const account = {
        owner: typeof accountOwner === 'object' ? accountOwner.address : accountOwner,
        number: accountNumber,
    };
    const rawBalanceWei = await core.dolomiteMargin.getAccountWei(account, marketId);
    const balanceWei = rawBalanceWei.sign ? rawBalanceWei.value : rawBalanceWei.value.mul(-1);
    const price = await core.dolomiteMargin.getMarketPrice(marketId);
    (0, chai_1.expect)(balanceWei.mul(price.value)).to.be.lt(maxDustyValueUsd);
}
exports.expectProtocolBalanceDustyOrZero = expectProtocolBalanceDustyOrZero;
async function expectWalletBalance(accountOwner, token, amount) {
    const owner = typeof accountOwner === 'object' ? accountOwner.address : accountOwner;
    (0, chai_1.expect)(await token.balanceOf(owner)).eq(amount);
}
exports.expectWalletBalance = expectWalletBalance;
async function expectVaultBalanceToMatchAccountBalances(core, vault, accounts, marketId) {
    let totalBalance = no_deps_constants_1.ZERO_BI;
    for (let i = 0; i < accounts.length; i++) {
        totalBalance = totalBalance.add((await core.dolomiteMargin.getAccountWei(accounts[i], marketId)).value);
    }
    (0, chai_1.expect)(await vault.underlyingBalanceOf()).eq(totalBalance);
}
exports.expectVaultBalanceToMatchAccountBalances = expectVaultBalanceToMatchAccountBalances;
async function expectWalletAllowance(accountOwner, accountSpender, token, amount) {
    const owner = typeof accountOwner === 'object' ? accountOwner.address : accountOwner;
    const spender = typeof accountSpender === 'object' ? accountSpender.address : accountSpender;
    (0, chai_1.expect)(await token.allowance(owner, spender)).eq(amount);
}
exports.expectWalletAllowance = expectWalletAllowance;
async function expectTotalSupply(token, amount) {
    (0, chai_1.expect)(await token.totalSupply()).eq(amount);
}
exports.expectTotalSupply = expectTotalSupply;
function expectAssetAmountToEq(found, expected) {
    (0, chai_1.expect)(found.sign).eq(expected.sign);
    (0, chai_1.expect)(found.denomination).eq(expected.denomination);
    (0, chai_1.expect)(found.ref).eq(expected.ref);
    (0, chai_1.expect)(found.value).eq(expected.value);
}
exports.expectAssetAmountToEq = expectAssetAmountToEq;
function expectArrayEq(array1, array2) {
    (0, chai_1.expect)(array1.length).eq(array2.length);
    for (let i = 0; i < array1.length; i++) {
        (0, chai_1.expect)(array1[i]).eq(array2[i]);
    }
}
exports.expectArrayEq = expectArrayEq;
