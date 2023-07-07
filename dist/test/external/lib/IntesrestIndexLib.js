"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const types_1 = require("../../../src/types");
const dolomite_utils_1 = require("../../../src/utils/dolomite-utils");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const setup_1 = require("../../utils/setup");
const depositAmount = ethers_1.BigNumber.from('5000000000'); // 5,000 USDC
const withdrawAmount = ethers_1.BigNumber.from('1000000000000000000'); // 1 ETH
const zeroPar = {
    sign: false,
    value: no_deps_constants_1.ZERO_BI,
};
const zeroWei = {
    sign: false,
    value: no_deps_constants_1.ZERO_BI,
};
const defaultAccountNumber = no_deps_constants_1.ZERO_BI;
describe('InterestIndexLib', () => {
    let snapshotId;
    let core;
    let testLib;
    let defaultAccount;
    let marketIdPositive;
    let marketIdNegative;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        testLib = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestInterestIndexLib__factory.abi, types_1.TestInterestIndexLib__factory.bytecode, [core.dolomiteMargin.address]);
        defaultAccount = {
            owner: core.hhUser1.address,
            number: defaultAccountNumber,
        };
        marketIdPositive = core.marketIds.usdc;
        marketIdNegative = core.marketIds.weth;
        await (0, setup_1.setupUSDCBalance)(core, core.hhUser1, depositAmount, core.dolomiteMargin);
        await (0, dolomite_utils_1.depositIntoDolomiteMargin)(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, depositAmount);
        await (0, dolomite_utils_1.withdrawFromDolomiteMargin)(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, withdrawAmount);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('parToWei', () => {
        it('should work for positive numbers', async () => {
            for (let i = 0; i < 10; i++) {
                const par = await core.dolomiteMargin.getAccountPar(defaultAccount, marketIdPositive);
                const wei = await core.dolomiteMargin.getAccountWei(defaultAccount, marketIdPositive);
                const foundWei = await testLib.parToWei(marketIdPositive, par);
                (0, chai_1.expect)(foundWei.sign).to.eq(wei.sign);
                (0, chai_1.expect)(foundWei.value).to.eq(wei.value);
                await (0, utils_1.waitDays)(1);
            }
        });
        it('should work for zero', async () => {
            const foundWeiPositive = await testLib.parToWei(marketIdPositive, zeroPar);
            (0, chai_1.expect)(foundWeiPositive.sign).to.eq(zeroWei.sign);
            (0, chai_1.expect)(foundWeiPositive.value).to.eq(zeroWei.value);
            const foundWeiNegative = await testLib.parToWei(marketIdNegative, zeroPar);
            (0, chai_1.expect)(foundWeiNegative.sign).to.eq(zeroWei.sign);
            (0, chai_1.expect)(foundWeiNegative.value).to.eq(zeroWei.value);
        });
        it('should work for negative numbers', async () => {
            for (let i = 0; i < 10; i++) {
                const par = await core.dolomiteMargin.getAccountPar(defaultAccount, marketIdNegative);
                const wei = await core.dolomiteMargin.getAccountWei(defaultAccount, marketIdNegative);
                const foundWei = await testLib.parToWei(marketIdNegative, par);
                (0, chai_1.expect)(foundWei.sign).to.eq(wei.sign);
                (0, chai_1.expect)(foundWei.value).to.eq(wei.value);
                await (0, utils_1.waitDays)(1);
            }
        });
    });
    describe('weiToPar', () => {
        it('should work for positive numbers', async () => {
            for (let i = 0; i < 10; i++) {
                const par = await core.dolomiteMargin.getAccountPar(defaultAccount, marketIdPositive);
                const wei = await core.dolomiteMargin.getAccountWei(defaultAccount, marketIdPositive);
                const foundPar = await testLib.weiToPar(marketIdPositive, wei);
                (0, chai_1.expect)(foundPar.sign).to.eq(par.sign);
                (0, chai_1.expect)(foundPar.value).to.eq(par.value);
                await (0, utils_1.waitDays)(1);
            }
        });
        it('should work for zero', async () => {
            const foundParPositive = await testLib.weiToPar(marketIdPositive, zeroWei);
            (0, chai_1.expect)(foundParPositive.sign).to.eq(zeroPar.sign);
            (0, chai_1.expect)(foundParPositive.value).to.eq(zeroPar.value);
            const foundParNegative = await testLib.weiToPar(marketIdNegative, zeroWei);
            (0, chai_1.expect)(foundParNegative.sign).to.eq(zeroPar.sign);
            (0, chai_1.expect)(foundParNegative.value).to.eq(zeroPar.value);
        });
        it('should work for negative numbers', async () => {
            for (let i = 0; i < 10; i++) {
                const par = await core.dolomiteMargin.getAccountPar(defaultAccount, marketIdNegative);
                const wei = await core.dolomiteMargin.getAccountWei(defaultAccount, marketIdNegative);
                const foundPar = await testLib.weiToPar(marketIdNegative, wei);
                (0, chai_1.expect)(foundPar.sign).to.eq(par.sign);
                (0, chai_1.expect)(foundPar.value).to.eq(par.value);
                await (0, utils_1.waitDays)(1);
            }
        });
    });
});
