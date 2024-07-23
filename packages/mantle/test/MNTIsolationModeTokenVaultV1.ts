import { expect } from 'chai';
import {
  ARBIsolationModeTokenVaultV1,
  ARBIsolationModeTokenVaultV1__factory,
  ARBIsolationModeVaultFactory,
  ARBRegistry,
} from '../src/types';
import {
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2,
} from '@dolomite-exchange/modules-base/src/types';
import { ADDRESS_ZERO, Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  createARBIsolationModeTokenVaultV1,
  createARBIsolationModeVaultFactory,
  createARBRegistry,
  createARBUnwrapperTraderV2,
  createARBWrapperTraderV2,
} from './mnt-ecosystem-utils';
import {
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { DEFAULT_BLOCK_NUMBER_FOR_MNT_TESTS } from './mnt-utils';

describe('ARBIsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let arbRegistry: ARBRegistry;
  let unwrapper: SimpleIsolationModeUnwrapperTraderV2;
  let wrapper: SimpleIsolationModeWrapperTraderV2;
  let arbFactory: ARBIsolationModeVaultFactory;
  let arbVault: ARBIsolationModeTokenVaultV1;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: DEFAULT_BLOCK_NUMBER_FOR_MNT_TESTS,
      network: Network.ArbitrumOne,
    });

    arbRegistry = await createARBRegistry(core);

    const vaultImplementation = await createARBIsolationModeTokenVaultV1();
    arbFactory = await createARBIsolationModeVaultFactory(arbRegistry, vaultImplementation, core);

    unwrapper = await createARBUnwrapperTraderV2(arbFactory, core);
    wrapper = await createARBWrapperTraderV2(arbFactory, core);
    await core.chainlinkPriceOracleV1!.connect(core.governance).ownerInsertOrUpdateOracleToken(
      arbFactory.address,
      await arbFactory.decimals(),
      await core.chainlinkPriceOracleV1!.getAggregatorByToken(core.tokens.arb!.address),
      ADDRESS_ZERO,
    );

    await setupTestMarket(core, arbFactory, true, core.chainlinkPriceOracleV1);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(arbFactory.address, true);
    await arbFactory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    await arbFactory.createVault(core.hhUser1.address);
    arbVault = setupUserVaultProxy<ARBIsolationModeTokenVaultV1>(
      await arbFactory.getVaultByAccount(core.hhUser1.address),
      ARBIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should set delegatee to vault owner if not already set', async () => {
      expect(await arbVault.delegates()).to.eq(core.hhUser1.address);
      expect(await core.arbEcosystem!.arb.delegates(arbVault.address)).to.eq(core.hhUser1.address);
    });

    it('should set delegatee to vault owner if already set', async () => {
      await core.arbEcosystem!.arb.connect(core.hhUser2).delegate(core.hhUser3.address);
      await arbFactory.createVault(core.hhUser2.address);
      const arbVault2 = setupUserVaultProxy<ARBIsolationModeTokenVaultV1>(
        await arbFactory.getVaultByAccount(core.hhUser2.address),
        ARBIsolationModeTokenVaultV1__factory,
        core.hhUser2,
      );

      expect(await arbVault2.delegates()).to.eq(core.hhUser3.address);
      expect(await core.arbEcosystem!.arb.delegates(arbVault2.address)).to.eq(core.hhUser3.address);
    });
  });

  describe('#delegate', () => {
    it('should work normally', async () => {
      await arbVault.connect(core.hhUser1).delegate(core.hhUser2.address);
      expect(await arbVault.delegates()).to.eq(core.hhUser2.address);
    });

    it('should fail if not called by the vault owner', async () => {
      await expectThrow(
        arbVault.connect(core.hhUser2).delegate(core.hhUser2.address),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail if set to 0 address', async () => {
      await expectThrow(
        arbVault.delegate(ADDRESS_ZERO),
        'MNTIsolationModeTokenVaultV1.sol: Invalid delegatee',
      );
    });
  });

  describe('#dolomiteRegistry', () => {
    it('should work', async () => {
      expect(await arbVault.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });
  });

  describe('#registry', () => {
    it('should work', async () => {
      expect(await arbVault.registry()).to.equal(arbRegistry.address);
    });
  });
});
