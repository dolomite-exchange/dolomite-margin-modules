import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import {
  PendleGLPRegistry,
  PendlePtGLP2024IsolationModeVaultFactory,
  PendlePtGLPPriceOracle,
  TestPendlePtOracle,
  TestPendlePtOracle__factory,
} from '../../src/types';
import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { increaseToTimestamp, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  createPendleGLPRegistry,
  createPendlePtGLP2024IsolationModeTokenVaultV1,
  createPendlePtGLP2024IsolationModeVaultFactory,
  createPendlePtGLPPriceOracle,
} from '../pendle-ecosystem-utils';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol, setupTestMarket } from '@dolomite-exchange/modules-base/test/utils/setup';

/**
 * This is the expected price at the following timestamp: 1700000000
 *
 * Keep in mind that Pendle's prices tick upward each second.
 */
const PT_GLP_PRICE = BigNumber.from('915069158541073688'); // $0.915069158541073688

describe('PendlePtGLPPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let ptGlpOracle: PendlePtGLPPriceOracle;
  let pendleRegistry: PendleGLPRegistry;
  let factory: PendlePtGLP2024IsolationModeVaultFactory;
  let marketId: BigNumberish;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));

    pendleRegistry = await createPendleGLPRegistry(core);
    const userVaultImplementation = await createPendlePtGLP2024IsolationModeTokenVaultV1();
    factory = await createPendlePtGLP2024IsolationModeVaultFactory(
      core,
      pendleRegistry,
      core.pendleEcosystem!.glpMar2024.ptGlpToken,
      userVaultImplementation,
    );
    ptGlpOracle = await createPendlePtGLPPriceOracle(
      core,
      factory,
      pendleRegistry,
    );
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, ptGlpOracle);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('constructor', () => {
    it('should work normally', async () => {
      expect(await ptGlpOracle.DPT_GLP()).to.eq(factory.address);
      expect(await ptGlpOracle.REGISTRY()).to.eq(pendleRegistry.address);
      expect(await ptGlpOracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await ptGlpOracle.DFS_GLP_MARKET_ID()).to.eq(core.marketIds.dfsGlp);
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
        createPendlePtGLPPriceOracle(core, factory, pendleRegistry),
        'PendlePtGLPPriceOracle: Oracle not ready yet',
      );

      await testPtOracle.setOracleState(false, 0, false);
      await expectThrow(
        createPendlePtGLPPriceOracle(core, factory, pendleRegistry),
        'PendlePtGLPPriceOracle: Oracle not ready yet',
      );

      await testPtOracle.setOracleState(true, 0, true);
      await expectThrow(
        createPendlePtGLPPriceOracle(core, factory, pendleRegistry),
        'PendlePtGLPPriceOracle: Oracle not ready yet',
      );

      await testPtOracle.setOracleState(false, 0, true);
      await createPendlePtGLPPriceOracle(core, factory, pendleRegistry); // should work now
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value under normal conditions for dptGLP', async () => {
      await increaseToTimestamp(1_700_000_000);
      const price = await ptGlpOracle.getPrice(factory.address);
      expect(price.value).to.eq(PT_GLP_PRICE);
    });

    it('fails when token sent is not dptGLP', async () => {
      await expectThrow(
        ptGlpOracle.getPrice(ADDRESSES.ZERO),
        `PendlePtGLPPriceOracle: invalid token <${ADDRESSES.ZERO}>`,
      );
      await expectThrow(
        ptGlpOracle.getPrice(core.gmxEcosystem!.fsGlp.address),
        `PendlePtGLPPriceOracle: invalid token <${core.gmxEcosystem!.fsGlp.address.toLowerCase()}>`,
      );
      await expectThrow(
        ptGlpOracle.getPrice(core.tokens.dfsGlp!.address),
        `PendlePtGLPPriceOracle: invalid token <${(core.tokens.dfsGlp!.address).toLowerCase()}>`,
      );
      await expectThrow(
        ptGlpOracle.getPrice(core.gmxEcosystem!.glp.address),
        `PendlePtGLPPriceOracle: invalid token <${core.gmxEcosystem!.glp.address.toLowerCase()}>`,
      );
    });

    it('fails when ptGLP is borrowable', async () => {
      await core.dolomiteMargin.ownerSetIsClosing(marketId, false);
      await expectThrow(
        ptGlpOracle.getPrice(factory.address),
        'PendlePtGLPPriceOracle: ptGLP cannot be borrowable',
      );
    });
  });
});
