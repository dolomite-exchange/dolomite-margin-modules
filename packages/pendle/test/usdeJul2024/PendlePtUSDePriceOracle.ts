import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { advanceToTimestamp, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  setupCoreProtocol,
  setupTestMarket,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import {
  IERC20,
  PendlePtIsolationModeVaultFactory,
  PendlePtPriceOracleV2,
  PendleRegistry,
  TestPendlePtOracle,
  TestPendlePtOracle__factory,
} from '../../src/types';
import {
  createPendlePtIsolationModeTokenVaultV1,
  createPendlePtIsolationModeVaultFactory,
  createPendlePtPriceOracle,
  createPendlePtPriceOracleV2,
  createPendleRegistry,
} from '../pendle-ecosystem-utils';
import { CoreProtocolMantle } from 'packages/base/test/utils/core-protocols/core-protocol-mantle';

const PT_USDE_PRICE = BigNumber.from('958657134500514025');

describe('PendlePtUSDeJul2024PriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolMantle;
  let ptOracle: PendlePtPriceOracleV2;
  let pendleRegistry: PendleRegistry;
  let factory: PendlePtIsolationModeVaultFactory;
  let marketId: BigNumberish;
  let underlyingToken: IERC20;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 64_650_000,
      network: Network.Mantle,
    });

    underlyingToken = core.tokens.usde!;

    pendleRegistry = await createPendleRegistry(
      core,
      core.pendleEcosystem!.usdeJul2024.usdeMarket,
      core.pendleEcosystem!.usdeJul2024.ptOracle,
      core.pendleEcosystem!.syUsdeToken,
    );
    const userVaultImplementation = await createPendlePtIsolationModeTokenVaultV1();
    factory = await createPendlePtIsolationModeVaultFactory(
      core,
      pendleRegistry,
      core.pendleEcosystem!.usdeJul2024.ptUSDeToken,
      userVaultImplementation,
    );
    ptOracle = await createPendlePtPriceOracleV2(
      core,
      factory,
      pendleRegistry,
    );
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, ptOracle);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('constructor', () => {
    it('should work normally', async () => {
      expect(await ptOracle.DPT_TOKEN()).to.eq(factory.address);
      expect(await ptOracle.REGISTRY()).to.eq(pendleRegistry.address);
      expect(await ptOracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });

    it('should fail when oracle is not ready yet', async () => {
      const testPtOracle = await createContractWithAbi<TestPendlePtOracle>(
        TestPendlePtOracle__factory.abi,
        TestPendlePtOracle__factory.bytecode,
        [],
      );
      await pendleRegistry.connect(core.governance).ownerSetPtOracle(testPtOracle.address);

      await testPtOracle.setOracleState(true, 0, false);
      await expectThrow(
        createPendlePtPriceOracle(core, factory, pendleRegistry, underlyingToken),
        'PendlePtPriceOracle: Oracle not ready yet',
      );

      await testPtOracle.setOracleState(false, 0, false);
      await expectThrow(
        createPendlePtPriceOracle(core, factory, pendleRegistry, underlyingToken),
        'PendlePtPriceOracle: Oracle not ready yet',
      );

      await testPtOracle.setOracleState(true, 0, true);
      await expectThrow(
        createPendlePtPriceOracle(core, factory, pendleRegistry, underlyingToken),
        'PendlePtPriceOracle: Oracle not ready yet',
      );

      await testPtOracle.setOracleState(false, 0, true);
      await createPendlePtPriceOracle(core, factory, pendleRegistry, underlyingToken); // should work now
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value under normal conditions for the dptToken', async () => {
      await advanceToTimestamp(1717500000);
      const price = await ptOracle.getPrice(factory.address);
      expect(price.value).to.eq(PT_USDE_PRICE);
    });

    it('fails when token sent is not dpt', async () => {
      await expectThrow(
        ptOracle.getPrice(ADDRESSES.ZERO),
        `PendlePtPriceOracle: invalid token <${ADDRESSES.ZERO}>`,
      );
      await expectThrow(
        ptOracle.getPrice(core.tokens.usdc.address),
        `PendlePtPriceOracle: invalid token <${core.tokens.usdc.address.toLowerCase()}>`,
      );
      await expectThrow(
        ptOracle.getPrice(core.tokens.meth.address),
        `PendlePtPriceOracle: invalid token <${(core.tokens.meth.address).toLowerCase()}>`,
      );
    });

    it('fails when pt is borrowable', async () => {
      await core.dolomiteMargin.ownerSetIsClosing(marketId, false);
      await expectThrow(
        ptOracle.getPrice(factory.address),
        'PendlePtPriceOracle: PT cannot be borrowable',
      );
    });
  });
});
