"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const types_1 = require("../../../src/types");
const dolomite_utils_1 = require("../../../src/utils/dolomite-utils");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const setup_1 = require("../../utils/setup");
const amount1 = ethers_1.BigNumber.from('200000000');
const amount2 = ethers_1.BigNumber.from('500000000');
describe('ERC20Lib', () => {
    let snapshotId;
    let core;
    let testLib;
    let token1;
    let token2;
    let spender1;
    let spender2;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        testLib = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestERC20Lib__factory.abi, types_1.TestERC20Lib__factory.bytecode, []);
        token1 = await (0, dolomite_utils_1.createTestToken)();
        token2 = await (0, dolomite_utils_1.createTestToken)();
        spender1 = core.hhUser1.address;
        spender2 = core.hhUser2.address;
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('resetAllowanceIfNeededAndApprove', () => {
        it('should work for various tokens', async () => {
            await expectAllowance(token1, spender1, no_deps_constants_1.ZERO_BI);
            await expectAllowance(token1, spender2, no_deps_constants_1.ZERO_BI);
            await expectAllowance(token2, spender1, no_deps_constants_1.ZERO_BI);
            await expectAllowance(token2, spender2, no_deps_constants_1.ZERO_BI);
            await testLib.resetAllowanceIfNeededAndApprove(token1.address, spender1, amount1);
            await expectAllowance(token1, spender1, amount1);
            await expectAllowance(token1, spender2, no_deps_constants_1.ZERO_BI);
            await expectAllowance(token2, spender1, no_deps_constants_1.ZERO_BI);
            await expectAllowance(token2, spender2, no_deps_constants_1.ZERO_BI);
            // reset the allowance to be larger
            await testLib.resetAllowanceIfNeededAndApprove(token1.address, spender1, amount2);
            await expectAllowance(token1, spender1, amount2);
            await expectAllowance(token1, spender2, no_deps_constants_1.ZERO_BI);
            await expectAllowance(token2, spender1, no_deps_constants_1.ZERO_BI);
            await expectAllowance(token2, spender2, no_deps_constants_1.ZERO_BI);
            await testLib.resetAllowanceIfNeededAndApprove(token2.address, spender1, amount1);
            await expectAllowance(token1, spender1, amount2);
            await expectAllowance(token1, spender2, no_deps_constants_1.ZERO_BI);
            await expectAllowance(token2, spender1, amount1);
            await expectAllowance(token2, spender2, no_deps_constants_1.ZERO_BI);
            await testLib.resetAllowanceIfNeededAndApprove(token2.address, spender2, amount2);
            await expectAllowance(token1, spender1, amount2);
            await expectAllowance(token1, spender2, no_deps_constants_1.ZERO_BI);
            await expectAllowance(token2, spender1, amount1);
            await expectAllowance(token2, spender2, amount2);
        });
    });
    async function expectAllowance(token, spender, expected) {
        (0, chai_1.expect)(await token.allowance(testLib.address, spender)).to.eq(expected);
    }
});
