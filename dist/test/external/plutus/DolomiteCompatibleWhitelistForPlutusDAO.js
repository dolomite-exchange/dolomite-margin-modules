"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Addresses_1 = require("@openzeppelin/upgrades/lib/utils/Addresses");
const chai_1 = require("chai");
const types_1 = require("../../../src/types");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const plutus_1 = require("../../utils/ecosystem-token-utils/plutus");
const setup_1 = require("../../utils/setup");
const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
describe('DolomiteCompatibleWhitelistForPlutusDAO', () => {
    let snapshotId;
    let core;
    let dolomiteWhitelist;
    let unwrapperTrader;
    let wrapperTrader;
    let plutusWhitelist;
    let factory;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)({
            blockNumber: 86413000,
            network: no_deps_constants_1.Network.ArbitrumOne,
        });
        const plutusVaultRegistry = await (0, plutus_1.createPlutusVaultRegistry)(core);
        const userVaultImplementation = await (0, plutus_1.createPlutusVaultGLPIsolationModeTokenVaultV1)();
        factory = await (0, plutus_1.createPlutusVaultGLPIsolationModeVaultFactory)(core, plutusVaultRegistry, core.plutusEcosystem.plvGlp, userVaultImplementation);
        unwrapperTrader = await (0, plutus_1.createPlutusVaultGLPIsolationModeUnwrapperTraderV1)(core, plutusVaultRegistry, factory);
        wrapperTrader = await (0, plutus_1.createPlutusVaultGLPIsolationModeWrapperTraderV1)(core, plutusVaultRegistry, factory);
        plutusWhitelist = types_1.IWhitelist__factory.connect(await core.plutusEcosystem.plvGlpFarm.whitelist(), core.hhUser1);
        (0, chai_1.expect)(plutusWhitelist.address).to.eql('0x16240aC2fBD41F4087421E1525f74338Bc95Cf64');
        await core.testPriceOracle.setPrice(factory.address, '1');
        await (0, setup_1.setupTestMarket)(core, factory, true);
        await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
        await factory.connect(core.governance).ownerInitialize([unwrapperTrader.address, wrapperTrader.address]);
        dolomiteWhitelist = await (0, plutus_1.createDolomiteCompatibleWhitelistForPlutusDAO)(core, unwrapperTrader, wrapperTrader, plutusWhitelist.address, factory);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#contructor', () => {
        it('should initialize variables properly', async () => {
            (0, chai_1.expect)(await dolomiteWhitelist.plvGlpUnwrapperTrader()).to.equal(unwrapperTrader.address);
            (0, chai_1.expect)(await dolomiteWhitelist.plvGlpWrapperTrader()).to.equal(wrapperTrader.address);
            (0, chai_1.expect)(await dolomiteWhitelist.PLUTUS_WHITELIST()).to.equal(plutusWhitelist.address);
            (0, chai_1.expect)(await dolomiteWhitelist.DOLOMITE_PLV_GLP_WRAPPER()).to.equal(factory.address);
            (0, chai_1.expect)(await dolomiteWhitelist.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
        });
    });
    describe('#ownerSetPlvGlpUnwrapperTrader', () => {
        it('should work normally', async () => {
            const result = await dolomiteWhitelist.connect(core.governance).ownerSetPlvGlpUnwrapperTrader(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(dolomiteWhitelist, result, 'PlvGlpUnwrapperTraderSet', {
                plvGlpUnwrapperTrader: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await dolomiteWhitelist.plvGlpUnwrapperTrader()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(dolomiteWhitelist.connect(core.hhUser1).ownerSetPlvGlpUnwrapperTrader(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(dolomiteWhitelist.connect(core.governance).ownerSetPlvGlpUnwrapperTrader(Addresses_1.ZERO_ADDRESS), 'DolomiteCompatibleWhitelist: Invalid plvGlpUnwrapperTrader');
        });
    });
    describe('#ownerSetPlvGlpWrapperTrader', () => {
        it('should work normally', async () => {
            const result = await dolomiteWhitelist.connect(core.governance).ownerSetPlvGlpWrapperTrader(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(dolomiteWhitelist, result, 'PlvGlpWrapperTraderSet', {
                plvGlpWrapperTrader: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await dolomiteWhitelist.plvGlpWrapperTrader()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(dolomiteWhitelist.connect(core.hhUser1).ownerSetPlvGlpWrapperTrader(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(dolomiteWhitelist.connect(core.governance).ownerSetPlvGlpWrapperTrader(Addresses_1.ZERO_ADDRESS), 'DolomiteCompatibleWhitelist: Invalid plvGlpWrapperTrader');
        });
    });
    describe('#isWhitelisted', () => {
        it('should work for old whitelisted address', async () => {
            const oldWhitelistedAddress = '0xfF1249c81e6614796381e0b9c88a3D080dAD01dF';
            (0, chai_1.expect)(await dolomiteWhitelist.isWhitelisted(oldWhitelistedAddress)).to.eql(true);
        });
        it('should work for traders', async () => {
            (0, chai_1.expect)(await dolomiteWhitelist.isWhitelisted(unwrapperTrader.address)).to.eql(true);
            (0, chai_1.expect)(await dolomiteWhitelist.isWhitelisted(wrapperTrader.address)).to.eql(true);
        });
        it('should work for Dolomite vaults', async () => {
            await factory.createVault(core.hhUser1.address);
            await factory.createVault(core.hhUser2.address);
            await factory.createVault(core.hhUser3.address);
            const vault1 = await factory.getVaultByAccount(core.hhUser1.address);
            const vault2 = await factory.getVaultByAccount(core.hhUser2.address);
            const vault3 = await factory.getVaultByAccount(core.hhUser3.address);
            (0, chai_1.expect)(await dolomiteWhitelist.isWhitelisted(vault1)).to.eql(true);
            (0, chai_1.expect)(await dolomiteWhitelist.isWhitelisted(vault2)).to.eql(true);
            (0, chai_1.expect)(await dolomiteWhitelist.isWhitelisted(vault3)).to.eql(true);
            (0, chai_1.expect)(await dolomiteWhitelist.isWhitelisted(core.hhUser1.address)).to.eql(false);
            (0, chai_1.expect)(await dolomiteWhitelist.isWhitelisted(core.hhUser2.address)).to.eql(false);
            (0, chai_1.expect)(await dolomiteWhitelist.isWhitelisted(core.hhUser3.address)).to.eql(false);
            const vault4 = await factory.calculateVaultByAccount(core.hhUser4.address);
            const vault5 = await factory.calculateVaultByAccount(core.hhUser5.address);
            (0, chai_1.expect)(await dolomiteWhitelist.isWhitelisted(vault4)).to.eql(false);
            (0, chai_1.expect)(await dolomiteWhitelist.isWhitelisted(vault5)).to.eql(false);
            await factory.createVault(core.hhUser4.address);
            await factory.createVault(core.hhUser5.address);
            (0, chai_1.expect)(await dolomiteWhitelist.isWhitelisted(vault4)).to.eql(true);
            (0, chai_1.expect)(await dolomiteWhitelist.isWhitelisted(vault5)).to.eql(true);
        });
        it('should return false for anything else', async () => {
            (0, chai_1.expect)(await dolomiteWhitelist.isWhitelisted(OTHER_ADDRESS)).to.eql(false);
        });
    });
});
