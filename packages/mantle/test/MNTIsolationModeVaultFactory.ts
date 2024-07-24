import {
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2,
} from '@dolomite-exchange/modules-base/src/types';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol, setupTestMarket } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { CoreProtocolMantle } from 'packages/base/test/utils/core-protocols/core-protocol-mantle';
import { MNTIsolationModeTokenVaultV1, MNTIsolationModeVaultFactory, MNTRegistry } from '../src/types';
import {
  createMNTIsolationModeTokenVaultV1,
  createMNTIsolationModeVaultFactory,
  createMNTRegistry,
  createMNTUnwrapperTraderV2,
  createMNTWrapperTraderV2,
} from './mnt-ecosystem-utils';
import { DEFAULT_BLOCK_NUMBER_FOR_MNT_TESTS } from './mnt-utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('MNTIsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocolMantle;
  let mntRegistry: MNTRegistry;
  let unwrapper: SimpleIsolationModeUnwrapperTraderV2;
  let wrapper: SimpleIsolationModeWrapperTraderV2;
  let mntFactory: MNTIsolationModeVaultFactory;
  let vaultImplementation: MNTIsolationModeTokenVaultV1;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: DEFAULT_BLOCK_NUMBER_FOR_MNT_TESTS,
      network: Network.Mantle,
    });

    mntRegistry = await createMNTRegistry(core);

    vaultImplementation = await createMNTIsolationModeTokenVaultV1();
    mntFactory = await createMNTIsolationModeVaultFactory(mntRegistry, vaultImplementation, core);

    unwrapper = await createMNTUnwrapperTraderV2(mntFactory, core);
    wrapper = await createMNTWrapperTraderV2(mntFactory, core);
    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
      token: mntFactory.address,
      decimals: 18,
      oracleInfos: await core.oracleAggregatorV2.getOraclesByToken(core.tokens.wmnt.address),
    });
    await core.chroniclePriceOracleV3
      .connect(core.governance)
      .ownerInsertOrUpdateOracleToken(
        mntFactory.address,
        await core.chroniclePriceOracleV3.getScribeByToken(core.tokens.wmnt.address),
        false,
      );

    await setupTestMarket(core, mntFactory, true, core.oracleAggregatorV2);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(mntFactory.address, true);
    await mntFactory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    await mntFactory.createVault(core.hhUser1.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await mntFactory.mntRegistry()).to.equal(mntRegistry.address);
      expect(await mntFactory.UNDERLYING_TOKEN()).to.equal(core.tokens.wmnt.address);
      expect(await mntFactory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
      expect(await mntFactory.userVaultImplementation()).to.equal(vaultImplementation.address);
      expect(await mntFactory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#setMNTRegistry', () => {
    it('should work normally', async () => {
      const result = await mntFactory.connect(core.governance).setMNTRegistry(OTHER_ADDRESS);
      await expectEvent(mntFactory, result, 'MNTRegistrySet', {
        mntRegistry: OTHER_ADDRESS,
      });
      expect(await mntFactory.mntRegistry()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        mntFactory.connect(core.hhUser1).setMNTRegistry(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#allowableCollateralMarketIds', () => {
    it('should work normally', async () => {
      expect(await mntFactory.allowableCollateralMarketIds()).to.deep.equal([]);
    });
  });

  describe('#allowableDebtMarketIds', () => {
    it('should work normally', async () => {
      expect(await mntFactory.allowableDebtMarketIds()).to.deep.equal([]);
    });
  });
});
