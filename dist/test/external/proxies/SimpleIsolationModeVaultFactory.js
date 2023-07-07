"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const types_1 = require("../../../src/types");
const dolomite_utils_1 = require("../../../src/utils/dolomite-utils");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const setup_1 = require("../../utils/setup");
describe('SimpleIsolationModeVaultFactory', () => {
    let snapshotId;
    let core;
    let underlyingToken;
    let underlyingMarketId;
    let otherToken;
    let otherMarketId;
    let rewardToken;
    let rewardMarketId;
    let tokenUnwrapper;
    let tokenWrapper;
    let factory;
    let userVaultImplementation;
    let initializeResult;
    let solidAccount;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        underlyingToken = await (0, dolomite_utils_1.createTestToken)();
        otherToken = await (0, dolomite_utils_1.createTestToken)();
        userVaultImplementation = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestIsolationModeTokenVaultV1__factory.abi, types_1.TestIsolationModeTokenVaultV1__factory.bytecode, []);
        const initialAllowableDebtMarketIds = [0, 1];
        const initialAllowableCollateralMarketIds = [2, 3];
        factory = await (0, dolomite_utils_1.createContractWithAbi)(types_1.SimpleIsolationModeVaultFactory__factory.abi, types_1.SimpleIsolationModeVaultFactory__factory.bytecode, [
            initialAllowableDebtMarketIds,
            initialAllowableCollateralMarketIds,
            underlyingToken.address,
            core.borrowPositionProxyV2.address,
            userVaultImplementation.address,
            core.dolomiteMargin.address,
        ]);
        await core.testPriceOracle.setPrice(factory.address, '1000000000000000000');
        await core.testPriceOracle.setPrice(otherToken.address, '1000000000000000000');
        underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, factory, true);
        otherMarketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, otherToken, false);
        rewardToken = await (0, dolomite_utils_1.createTestToken)();
        await core.testPriceOracle.setPrice(rewardToken.address, '1000000000000000000');
        rewardMarketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, rewardToken, false);
        tokenUnwrapper = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestIsolationModeUnwrapperTraderV1__factory.abi, types_1.TestIsolationModeUnwrapperTraderV1__factory.bytecode, [
            otherToken.address,
            factory.address,
            core.dolomiteMargin.address,
        ]);
        tokenWrapper = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestIsolationModeWrapperTraderV1__factory.abi, types_1.TestIsolationModeWrapperTraderV1__factory.bytecode, [factory.address, core.dolomiteMargin.address]);
        await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(tokenWrapper.address, true);
        initializeResult = await factory.connect(core.governance)
            .ownerInitialize([tokenUnwrapper.address, tokenWrapper.address]);
        await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
        solidAccount = core.hhUser5;
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#ownerSetAllowableDebtMarketIds', () => {
        it('should work normally', async () => {
            const newAllowableDebtMarketIds = [ethers_1.BigNumber.from(4), ethers_1.BigNumber.from(5)];
            const result = await factory.connect(core.governance).ownerSetAllowableDebtMarketIds(newAllowableDebtMarketIds);
            await (0, assertions_1.expectEvent)(factory, result, 'AllowableDebtMarketIdsSet', {
                newAllowableDebtMarketIds,
            });
            (0, assertions_1.expectArrayEq)(await factory.allowableDebtMarketIds(), newAllowableDebtMarketIds);
        });
        it('should not work when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(factory.connect(solidAccount).ownerSetAllowableDebtMarketIds([4, 5]), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${solidAccount.address.toLowerCase()}>`);
        });
    });
    describe('#ownerSetAllowableCollateralMarketIds', () => {
        it('should work normally', async () => {
            const newAllowableCollateralMarketIds = [ethers_1.BigNumber.from(4), ethers_1.BigNumber.from(5)];
            const result = await factory.connect(core.governance)
                .ownerSetAllowableCollateralMarketIds(newAllowableCollateralMarketIds);
            await (0, assertions_1.expectEvent)(factory, result, 'AllowableCollateralMarketIdsSet', {
                newAllowableCollateralMarketIds,
            });
            (0, assertions_1.expectArrayEq)(await factory.allowableCollateralMarketIds(), newAllowableCollateralMarketIds);
        });
        it('should not work when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(factory.connect(solidAccount).ownerSetAllowableCollateralMarketIds([4, 5]), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${solidAccount.address.toLowerCase()}>`);
        });
    });
    describe('#allowableDebtMarketIds', () => {
        it('should work normally after construction', async () => {
            (0, assertions_1.expectArrayEq)(await factory.allowableDebtMarketIds(), [0, 1]);
        });
    });
    describe('#allowableCollateralMarketIds', () => {
        it('should work normally after construction', async () => {
            (0, assertions_1.expectArrayEq)(await factory.allowableCollateralMarketIds(), [2, 3]);
        });
    });
});
