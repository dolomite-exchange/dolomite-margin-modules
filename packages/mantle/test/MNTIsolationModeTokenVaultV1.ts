import { expect } from 'chai';
import {
  MNTIsolationModeTokenVaultV1,
  MNTIsolationModeTokenVaultV1__factory,
  MNTIsolationModeVaultFactory,
  MNTRegistry,
} from '../src/types';
import {
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2,
} from '@dolomite-exchange/modules-base/src/types';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import {
  createMNTIsolationModeTokenVaultV1,
  createMNTIsolationModeVaultFactory,
  createMNTRegistry,
  createMNTUnwrapperTraderV2,
  createMNTWrapperTraderV2,
} from './mnt-ecosystem-utils';
import {
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { DEFAULT_BLOCK_NUMBER_FOR_MNT_TESTS } from './mnt-utils';
import { CoreProtocolMantle } from '@dolomite-exchange/modules-base/test/utils/core-protocols/core-protocol-mantle';

describe('MNTIsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocolMantle;
  let mntRegistry: MNTRegistry;
  let unwrapper: SimpleIsolationModeUnwrapperTraderV2;
  let wrapper: SimpleIsolationModeWrapperTraderV2;
  let mntFactory: MNTIsolationModeVaultFactory;
  let mntVault: MNTIsolationModeTokenVaultV1;

  before(async () => {
    console.log('STEP 1');
    core = await setupCoreProtocol({
      blockNumber: DEFAULT_BLOCK_NUMBER_FOR_MNT_TESTS,
      network: Network.Mantle,
    });
    console.log('STEP 2');

    mntRegistry = await createMNTRegistry(core);

    const vaultImplementation = await createMNTIsolationModeTokenVaultV1();
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

    console.log('STEP 1');
    await setupTestMarket(core, mntFactory, true, core.oracleAggregatorV2);
    console.log('STEP 2');
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(mntFactory.address, true);
    console.log('STEP 3');
    await mntFactory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    console.log('STEP 4');

    await mntFactory.createVault(core.hhUser1.address);
    console.log('STEP 5');
    mntVault = setupUserVaultProxy<MNTIsolationModeTokenVaultV1>(
      await mntFactory.getVaultByAccount(core.hhUser1.address),
      MNTIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
  });

  describe('#dolomiteRegistry', () => {
    it('should work', async () => {
      expect(await mntVault.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });
  });

  describe('#registry', () => {
    it('should work', async () => {
      expect(await mntVault.registry()).to.equal(mntRegistry.address);
    });
  });
});
