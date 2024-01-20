import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import {
  DolomiteCompatibleWhitelistForPlutusDAO,
  IWhitelist,
  IWhitelist__factory,
  PlutusVaultGLPIsolationModeUnwrapperTraderV1,
  PlutusVaultGLPIsolationModeVaultFactory,
  PlutusVaultGLPIsolationModeWrapperTraderV1,
} from '../src/types';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  createDolomiteCompatibleWhitelistForPlutusDAO,
  createPlutusVaultGLPIsolationModeTokenVaultV1,
  createPlutusVaultGLPIsolationModeUnwrapperTraderV1,
  createPlutusVaultGLPIsolationModeVaultFactory,
  createPlutusVaultGLPIsolationModeWrapperTraderV1,
  createPlutusVaultRegistry,
} from './plutus-ecosystem-utils';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol, setupTestMarket } from '@dolomite-exchange/modules-base/test/utils/setup';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('DolomiteCompatibleWhitelistForPlutusDAO', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let dolomiteWhitelist: DolomiteCompatibleWhitelistForPlutusDAO;
  let unwrapperTrader: PlutusVaultGLPIsolationModeUnwrapperTraderV1;
  let wrapperTrader: PlutusVaultGLPIsolationModeWrapperTraderV1;
  let plutusWhitelist: IWhitelist;
  let factory: PlutusVaultGLPIsolationModeVaultFactory;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    const plutusVaultRegistry = await createPlutusVaultRegistry(core);
    const userVaultImplementation = await createPlutusVaultGLPIsolationModeTokenVaultV1(core);
    factory = await createPlutusVaultGLPIsolationModeVaultFactory(
      core,
      plutusVaultRegistry,
      core.plutusEcosystem!.plvGlp,
      userVaultImplementation,
    );
    unwrapperTrader = await createPlutusVaultGLPIsolationModeUnwrapperTraderV1(core, plutusVaultRegistry, factory);
    wrapperTrader = await createPlutusVaultGLPIsolationModeWrapperTraderV1(core, plutusVaultRegistry, factory);
    plutusWhitelist = IWhitelist__factory.connect(
      await core.plutusEcosystem!.plvGlpFarm.whitelist(),
      core.hhUser1,
    );
    expect(plutusWhitelist.address).to.eql('0x4F8B6EF682Ee0e3a66eb5507dfb0DaA647362C20');
    await core.testEcosystem!.testPriceOracle.setPrice(factory.address, '1');
    await setupTestMarket(core, factory, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.connect(core.governance).ownerInitialize([unwrapperTrader.address, wrapperTrader.address]);
    dolomiteWhitelist = await createDolomiteCompatibleWhitelistForPlutusDAO(
      core,
      unwrapperTrader,
      wrapperTrader,
      plutusWhitelist.address,
      factory,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await dolomiteWhitelist.plvGlpUnwrapperTrader()).to.equal(unwrapperTrader.address);
      expect(await dolomiteWhitelist.plvGlpWrapperTrader()).to.equal(wrapperTrader.address);
      expect(await dolomiteWhitelist.PLUTUS_WHITELIST()).to.equal(plutusWhitelist.address);
      expect(await dolomiteWhitelist.DOLOMITE_PLV_GLP_WRAPPER()).to.equal(factory.address);
      expect(await dolomiteWhitelist.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#ownerSetPlvGlpUnwrapperTrader', () => {
    it('should work normally', async () => {
      const result = await dolomiteWhitelist.connect(core.governance).ownerSetPlvGlpUnwrapperTrader(OTHER_ADDRESS);
      await expectEvent(dolomiteWhitelist, result, 'PlvGlpUnwrapperTraderSet', {
        plvGlpUnwrapperTrader: OTHER_ADDRESS,
      });
      expect(await dolomiteWhitelist.plvGlpUnwrapperTrader()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        dolomiteWhitelist.connect(core.hhUser1).ownerSetPlvGlpUnwrapperTrader(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        dolomiteWhitelist.connect(core.governance).ownerSetPlvGlpUnwrapperTrader(ZERO_ADDRESS),
        'DolomiteCompatibleWhitelist: Invalid plvGlpUnwrapperTrader',
      );
    });
  });

  describe('#ownerSetPlvGlpWrapperTrader', () => {
    it('should work normally', async () => {
      const result = await dolomiteWhitelist.connect(core.governance).ownerSetPlvGlpWrapperTrader(OTHER_ADDRESS);
      await expectEvent(dolomiteWhitelist, result, 'PlvGlpWrapperTraderSet', {
        plvGlpWrapperTrader: OTHER_ADDRESS,
      });
      expect(await dolomiteWhitelist.plvGlpWrapperTrader()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        dolomiteWhitelist.connect(core.hhUser1).ownerSetPlvGlpWrapperTrader(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        dolomiteWhitelist.connect(core.governance).ownerSetPlvGlpWrapperTrader(ZERO_ADDRESS),
        'DolomiteCompatibleWhitelist: Invalid plvGlpWrapperTrader',
      );
    });
  });

  describe('#isWhitelisted', () => {
    it('should work for old whitelisted address', async () => {
      const oldWhitelistedAddress = '0xfF1249c81e6614796381e0b9c88a3D080dAD01dF';
      expect(await dolomiteWhitelist.isWhitelisted(oldWhitelistedAddress)).to.eql(true);
    });

    it('should work for traders', async () => {
      expect(await dolomiteWhitelist.isWhitelisted(unwrapperTrader.address)).to.eql(true);
      expect(await dolomiteWhitelist.isWhitelisted(wrapperTrader.address)).to.eql(true);
    });

    it('should work for Dolomite vaults', async () => {
      await factory.createVault(core.hhUser1.address);
      await factory.createVault(core.hhUser2.address);
      await factory.createVault(core.hhUser3.address);

      const vault1 = await factory.getVaultByAccount(core.hhUser1.address);
      const vault2 = await factory.getVaultByAccount(core.hhUser2.address);
      const vault3 = await factory.getVaultByAccount(core.hhUser3.address);

      expect(await dolomiteWhitelist.isWhitelisted(vault1)).to.eql(true);
      expect(await dolomiteWhitelist.isWhitelisted(vault2)).to.eql(true);
      expect(await dolomiteWhitelist.isWhitelisted(vault3)).to.eql(true);

      expect(await dolomiteWhitelist.isWhitelisted(core.hhUser1.address)).to.eql(false);
      expect(await dolomiteWhitelist.isWhitelisted(core.hhUser2.address)).to.eql(false);
      expect(await dolomiteWhitelist.isWhitelisted(core.hhUser3.address)).to.eql(false);

      const vault4 = await factory.calculateVaultByAccount(core.hhUser4.address);
      const vault5 = await factory.calculateVaultByAccount(core.hhUser5.address);

      expect(await dolomiteWhitelist.isWhitelisted(vault4)).to.eql(false);
      expect(await dolomiteWhitelist.isWhitelisted(vault5)).to.eql(false);

      await factory.createVault(core.hhUser4.address);
      await factory.createVault(core.hhUser5.address);

      expect(await dolomiteWhitelist.isWhitelisted(vault4)).to.eql(true);
      expect(await dolomiteWhitelist.isWhitelisted(vault5)).to.eql(true);
    });

    it('should return false for anything else', async () => {
      expect(await dolomiteWhitelist.isWhitelisted(OTHER_ADDRESS)).to.eql(false);
    });
  });
});
