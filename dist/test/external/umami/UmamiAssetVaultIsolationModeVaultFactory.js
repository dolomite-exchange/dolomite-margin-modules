"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const types_1 = require("../../../src/types");
const dolomite_utils_1 = require("../../../src/utils/dolomite-utils");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const umami_1 = require("../../utils/ecosystem-token-utils/umami");
const setup_1 = require("../../utils/setup");
const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
describe('UmamiAssetVaultIsolationModeVaultFactory', () => {
    let snapshotId;
    let core;
    let umamiRegistry;
    let userVaultImplementation;
    let factories;
    let underlyingAssets;
    let umamiAssets;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        umamiRegistry = await (0, umami_1.createUmamiAssetVaultRegistry)(core);
        userVaultImplementation = await (0, dolomite_utils_1.createContractWithAbi)(types_1.UmamiAssetVaultIsolationModeTokenVaultV1__factory.abi, types_1.UmamiAssetVaultIsolationModeTokenVaultV1__factory.bytecode, []);
        const umamiEcosystem = core.umamiEcosystem;
        umamiAssets = [umamiEcosystem.glpLink, umamiEcosystem.glpUsdc, umamiEcosystem.glpWbtc, umamiEcosystem.glpWeth];
        underlyingAssets = [core.tokens.link, core.tokens.usdc, core.tokens.wbtc, core.tokens.weth];
        factories = await Promise.all(umamiAssets.map((asset, i) => (0, umami_1.createUmamiAssetVaultIsolationModeVaultFactory)(core, umamiRegistry, asset, underlyingAssets[i], userVaultImplementation)));
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#contructor', () => {
        it('should initialize variables properly', async () => {
            for (let i = 0; i < factories.length; i++) {
                (0, chai_1.expect)(await factories[i].umamiAssetVaultRegistry()).to.equal(umamiRegistry.address);
                (0, chai_1.expect)(await factories[i].UNDERLYING_TOKEN()).to.equal(umamiAssets[i].address);
                (0, chai_1.expect)(await factories[i].BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
                (0, chai_1.expect)(await factories[i].userVaultImplementation()).to.equal(userVaultImplementation.address);
                (0, chai_1.expect)(await factories[i].DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
            }
        });
    });
    describe('#ownerSetUmamiAssetVaultRegistry', () => {
        it('should work normally', async () => {
            for (let i = 0; i < factories.length; i++) {
                const result = await factories[i].connect(core.governance).ownerSetUmamiAssetVaultRegistry(OTHER_ADDRESS);
                await (0, assertions_1.expectEvent)(factories[i], result, 'UmamiAssetVaultRegistrySet', {
                    umamiRegistry: OTHER_ADDRESS,
                });
                (0, chai_1.expect)(await factories[i].umamiAssetVaultRegistry()).to.equal(OTHER_ADDRESS);
            }
        });
        it('should fail when not called by owner', async () => {
            for (let i = 0; i < factories.length; i++) {
                await (0, assertions_1.expectThrow)(factories[i].connect(core.hhUser1).ownerSetUmamiAssetVaultRegistry(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
            }
        });
    });
    describe('#allowableCollateralMarketIds', () => {
        it('should work normally', async () => {
            for (let i = 0; i < factories.length; i++) {
                const result = await factories[i].allowableCollateralMarketIds();
                (0, chai_1.expect)(result.length).to.eql(1);
                (0, chai_1.expect)(result[0]).to.eq(no_deps_constants_1.NONE_MARKET_ID);
            }
        });
    });
    describe('#allowableDebtMarketIds', () => {
        it('should work normally', async () => {
            for (let i = 0; i < factories.length; i++) {
                const result = await factories[i].allowableDebtMarketIds();
                (0, chai_1.expect)(result.length).to.eql(1);
                const marketId = await core.dolomiteMargin.getMarketIdByTokenAddress(underlyingAssets[i].address);
                (0, chai_1.expect)(result[0]).to.eq(marketId);
            }
        });
    });
});
