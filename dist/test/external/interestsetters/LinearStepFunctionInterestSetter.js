"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Addresses_1 = require("@openzeppelin/upgrades/lib/utils/Addresses");
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const types_1 = require("../../../src/types");
const dolomite_utils_1 = require("../../../src/utils/dolomite-utils");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const setup_1 = require("../../utils/setup");
const zero = ethers_1.BigNumber.from(0);
const lowerRate = ethers_1.BigNumber.from('60000000000000000');
const upperRate = ethers_1.BigNumber.from('1000000000000000000');
const maximumRate = lowerRate.add(upperRate); // 106%
const secondsPerYear = ethers_1.BigNumber.from(31536000);
describe('LinearStepFunctionInterestSetter', () => {
    let snapshotId;
    let core;
    let interestSetter;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        interestSetter = await (0, dolomite_utils_1.createContractWithAbi)(types_1.LinearStepFunctionInterestSetter__factory.abi, types_1.LinearStepFunctionInterestSetter__factory.bytecode, [lowerRate, upperRate]);
        (0, chai_1.expect)(await interestSetter.interestSetterType()).to.eq(1); // linear
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#constructor', () => {
        it('should fail when rates are inverted', async () => {
            await (0, assertions_1.expectThrow)((0, dolomite_utils_1.createContractWithAbi)(types_1.LinearStepFunctionInterestSetter__factory.abi, types_1.LinearStepFunctionInterestSetter__factory.bytecode, [upperRate, lowerRate]), 'LinearStepFunctionInterestSetter: Lower optimal percent too high');
        });
    });
    describe('#getInterestRate', () => {
        it('Succeeds for 0/0', async () => {
            const rate = await interestSetter.getInterestRate(Addresses_1.ZERO_ADDRESS, 0, 0);
            (0, chai_1.expect)(rate.value).to.eq(zero.div(secondsPerYear));
        });
        it('Succeeds for 0/100', async () => {
            const rate = await interestSetter.getInterestRate(Addresses_1.ZERO_ADDRESS, 0, 100);
            (0, chai_1.expect)(rate.value).to.eq(zero.div(secondsPerYear));
        });
        it('Succeeds for 100/0', async () => {
            const rate = await interestSetter.getInterestRate(Addresses_1.ZERO_ADDRESS, 100, 0);
            (0, chai_1.expect)(rate.value).to.eq(lowerRate.add(upperRate).div(secondsPerYear));
        });
        it('Succeeds for 100/100', async () => {
            const rate = await interestSetter.getInterestRate(Addresses_1.ZERO_ADDRESS, 100, 100);
            (0, chai_1.expect)(rate.value).to.eq(maximumRate.div(secondsPerYear));
        });
        it('Succeeds for 200/100', async () => {
            const rate = await interestSetter.getInterestRate(Addresses_1.ZERO_ADDRESS, 200, 100);
            (0, chai_1.expect)(rate.value).to.eq(maximumRate.div(secondsPerYear));
        });
        it('Succeeds for 50/100', async () => {
            const rate = await interestSetter.getInterestRate(Addresses_1.ZERO_ADDRESS, 50, 100);
            (0, chai_1.expect)(rate.value).to.eq(ethers_1.BigNumber.from('33333333333333333').div(secondsPerYear)); // 3.3%
        });
        it('Succeeds for 0-90% (javscript)', async () => {
            const rate1 = await interestSetter.getInterestRate(Addresses_1.ZERO_ADDRESS, 0, 100);
            (0, chai_1.expect)(rate1.value).to.eq(zero.div(secondsPerYear)); // 0%
            const rate2 = await interestSetter.getInterestRate(Addresses_1.ZERO_ADDRESS, 45, 100);
            (0, chai_1.expect)(rate2.value).to.eq(ethers_1.BigNumber.from('30000000000000000').div(secondsPerYear)); // 3%
            const rate3 = await interestSetter.getInterestRate(Addresses_1.ZERO_ADDRESS, 90, 100);
            (0, chai_1.expect)(rate3.value).to.eq(ethers_1.BigNumber.from('60000000000000000').div(secondsPerYear)); // 6%
        });
        it('Succeeds for 91-100% (javscript)', async () => {
            const rate1 = await interestSetter.getInterestRate(Addresses_1.ZERO_ADDRESS, 91, 100);
            (0, chai_1.expect)(rate1.value).to.eq(ethers_1.BigNumber.from('160000000000000000').div(secondsPerYear)); // 16%
            const rate2 = await interestSetter.getInterestRate(Addresses_1.ZERO_ADDRESS, 95, 100);
            (0, chai_1.expect)(rate2.value).to.eq(ethers_1.BigNumber.from('560000000000000000').div(secondsPerYear)); // 56%
            const rate3 = await interestSetter.getInterestRate(Addresses_1.ZERO_ADDRESS, 99, 100);
            (0, chai_1.expect)(rate3.value).to.eq(ethers_1.BigNumber.from('960000000000000000').div(secondsPerYear)); // 96%
            const rate4 = await interestSetter.getInterestRate(Addresses_1.ZERO_ADDRESS, 100, 100);
            (0, chai_1.expect)(rate4.value).to.eq(ethers_1.BigNumber.from('1060000000000000000').div(secondsPerYear)); // 106%
        });
    });
});
