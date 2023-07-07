"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const types_1 = require("../../../src/types");
const dolomite_utils_1 = require("../../../src/utils/dolomite-utils");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const gmx_1 = require("../../utils/ecosystem-token-utils/gmx");
const setup_1 = require("../../utils/setup");
const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
describe('GLPIsolationModeVaultFactory', () => {
    let snapshotId;
    let core;
    let gmxRegistry;
    let vaultImplementation;
    let factory;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        gmxRegistry = await (0, gmx_1.createGmxRegistry)(core);
        vaultImplementation = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestGLPIsolationModeTokenVaultV1__factory.abi, types_1.TestGLPIsolationModeTokenVaultV1__factory.bytecode, []);
        factory = await (0, gmx_1.createGLPIsolationModeVaultFactory)(core, gmxRegistry, vaultImplementation);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#contructor', () => {
        it('should initialize variables properly', async () => {
            (0, chai_1.expect)(await factory.WETH()).to.equal(core.tokens.weth.address);
            (0, chai_1.expect)(await factory.WETH_MARKET_ID()).to.equal(core.marketIds.weth);
            (0, chai_1.expect)(await factory.gmxRegistry()).to.equal(gmxRegistry.address);
            (0, chai_1.expect)(await factory.UNDERLYING_TOKEN()).to.equal(core.gmxEcosystem.fsGlp.address);
            (0, chai_1.expect)(await factory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
            (0, chai_1.expect)(await factory.userVaultImplementation()).to.equal(vaultImplementation.address);
            (0, chai_1.expect)(await factory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
        });
    });
    describe('#createVaultAndAcceptFullAccountTransfer', () => {
        it('should work normally', async () => {
            const usdcAmount = ethers_1.BigNumber.from('100000000'); // 100 USDC
            await (0, setup_1.setupUSDCBalance)(core, core.hhUser1, usdcAmount, core.gmxEcosystem.glpManager);
            await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1).mintAndStakeGlp(core.tokens.usdc.address, usdcAmount, no_deps_constants_1.ONE_BI, no_deps_constants_1.ONE_BI);
            // use sGLP for approvals/transfers and fsGLP for checking balances
            const glpAmount = await core.gmxEcosystem.fsGlp.connect(core.hhUser1).balanceOf(core.hhUser1.address);
            const vaultAddress = await factory.connect(core.hhUser2).calculateVaultByAccount(core.hhUser2.address);
            await core.gmxEcosystem.gmxRewardsRouter.connect(core.hhUser1).signalTransfer(vaultAddress);
            await core.testPriceOracle.setPrice(factory.address, '1000000000000000000');
            await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
            await (0, setup_1.setupTestMarket)(core, factory, true);
            await factory.connect(core.governance).ownerInitialize([]);
            await factory.connect(core.hhUser2).createVaultAndAcceptFullAccountTransfer(core.hhUser1.address);
            const vault = (0, setup_1.setupUserVaultProxy)(vaultAddress, types_1.GLPIsolationModeTokenVaultV1__factory, core.hhUser2);
            (0, chai_1.expect)(await core.gmxEcosystem.fsGlp.connect(core.hhUser1).balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.fsGlp.connect(core.hhUser1).balanceOf(vaultAddress)).to.eq(glpAmount);
            (0, chai_1.expect)(await vault.underlyingBalanceOf()).to.eq(glpAmount);
        });
        it('should fail when not initialized yet', async () => {
            await (0, assertions_1.expectThrow)(factory.connect(core.hhUser2).createVaultAndAcceptFullAccountTransfer(core.hhUser1.address), 'IsolationModeVaultFactory: Not initialized');
        });
    });
    describe('#setGmxRegistry', () => {
        it('should work normally', async () => {
            const result = await factory.connect(core.governance).setGmxRegistry(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(factory, result, 'GmxRegistrySet', {
                gmxRegistry: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await factory.gmxRegistry()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(factory.connect(core.hhUser1).setGmxRegistry(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
    });
    describe('#allowableCollateralMarketIds', () => {
        it('should work normally', async () => {
            (0, chai_1.expect)(await factory.allowableCollateralMarketIds()).to.deep.equal([]);
        });
    });
    describe('#allowableDebtMarketIds', () => {
        it('should work normally', async () => {
            (0, chai_1.expect)(await factory.allowableDebtMarketIds()).to.deep.equal([]);
        });
    });
});
