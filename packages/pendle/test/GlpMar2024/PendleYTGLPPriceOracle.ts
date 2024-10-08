import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  getBlockTimestamp,
  increaseToTimestamp,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  IPendleYtToken__factory,
  PendleGLPRegistry,
  PendleYtGLPMar2024IsolationModeVaultFactory,
  PendleYtGLPPriceOracle,
  TestPendlePtOracle,
  TestPendlePtOracle__factory,
} from '../../src/types';
import {
  createPendleGLPRegistry,
  createPendleYtGLPMar2024IsolationModeTokenVaultV1,
  createPendleYtGLPMar2024IsolationModeVaultFactory,
  createPendleYtGLPPriceOracle,
} from '../pendle-ecosystem-utils';

/**
 * This is the expected price at the following timestamp: 1690134516
 *
 * Keep in mind that Pendle's PT prices tick upward each second so YT prices tick downward
 */
const PT_GLP_PRICE = BigNumber.from('1121325780731123745'); // $1.121325780731123745
const YT_GLP_PRICE = BigNumber.from('35919781432088543'); // $0.35919781432088543
const GLP_PRICE = BigNumber.from('1157245562163212289'); // $1.157245562163212289
const initialAllowableDebtMarketIds = [0, 1];
const initialAllowableCollateralMarketIds = [2, 3];

describe('PendleYtGLPPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let ytGlpOracle: PendleYtGLPPriceOracle;
  let pendleRegistry: PendleGLPRegistry;
  let factory: PendleYtGLPMar2024IsolationModeVaultFactory;
  let marketId: BigNumberish;
  let timestampTeleport: number;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    const timestamp = await getBlockTimestamp(getDefaultCoreProtocolConfig(Network.ArbitrumOne).blockNumber);
    timestampTeleport = timestamp + 600; // add 10 minutes

    pendleRegistry = await createPendleGLPRegistry(core);
    const userVaultImplementation = await createPendleYtGLPMar2024IsolationModeTokenVaultV1();
    factory = await createPendleYtGLPMar2024IsolationModeVaultFactory(
      core,
      pendleRegistry,
      initialAllowableDebtMarketIds,
      initialAllowableCollateralMarketIds,
      core.pendleEcosystem!.glpMar2024.ytGlpToken,
      userVaultImplementation,
    );
    ytGlpOracle = await createPendleYtGLPPriceOracle(
      core,
      factory,
      pendleRegistry,
    );
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, ytGlpOracle);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('constructor', () => {
    it('should work normally', async () => {
      expect(await ytGlpOracle.DYT_GLP()).to.eq(factory.address);
      expect(await ytGlpOracle.REGISTRY()).to.eq(pendleRegistry.address);
      expect(await ytGlpOracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await ytGlpOracle.DFS_GLP_MARKET_ID()).to.eq(core.marketIds.dfsGlp);
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
        createPendleYtGLPPriceOracle(core, factory, pendleRegistry),
        'PendleYtGLPPriceOracle: Oracle not ready yet',
      );
      await testPtOracle.setOracleState(false, 0, false);
      await expectThrow(
        createPendleYtGLPPriceOracle(core, factory, pendleRegistry),
        'PendleYtGLPPriceOracle: Oracle not ready yet',
      );

      await testPtOracle.setOracleState(true, 0, true);
      await expectThrow(
        createPendleYtGLPPriceOracle(core, factory, pendleRegistry),
        'PendleYtGLPPriceOracle: Oracle not ready yet',
      );

      await testPtOracle.setOracleState(false, 0, true);
      await createPendleYtGLPPriceOracle(core, factory, pendleRegistry); // should work now
    });
  });

  describe('#getPrice', () => {
    // @todo fix
    it('returns the correct value under normal conditions for dytGLP', async () => {
      await increaseToTimestamp(timestampTeleport);
      expect((await core.dolomiteMargin.getMarketPrice(core.marketIds.dPtGlpMar2024!)).value).to.eq(PT_GLP_PRICE);
      expect((await core.dolomiteMargin.getMarketPrice(core.marketIds.dfsGlp!)).value).to.eq(GLP_PRICE);
      expect((await ytGlpOracle.getPrice(factory.address)).value).to.eq(YT_GLP_PRICE);

      // Verify the two equal each other, roughly. YT_GLP is rounded down because of decimal truncation
      expect(GLP_PRICE.sub(PT_GLP_PRICE).sub(1)).to.eq(YT_GLP_PRICE);
    });

    it('returns 1 instead of 0 after maturity for dytGLP', async () => {
      const ytGlp = IPendleYtToken__factory.connect(await pendleRegistry.ytGlpToken(), core.hhUser1);
      await increaseToTimestamp((await ytGlp.expiry()).toNumber() + 1);
      expect((await ytGlpOracle.getPrice(factory.address)).value).to.eq(1);
    });

    it('fails when token sent is not dytGLP', async () => {
      await expectThrow(
        ytGlpOracle.getPrice(ADDRESSES.ZERO),
        `PendleYtGLPPriceOracle: Invalid token <${ADDRESSES.ZERO}>`,
      );
      await expectThrow(
        ytGlpOracle.getPrice(core.gmxEcosystem!.fsGlp.address),
        `PendleYtGLPPriceOracle: Invalid token <${core.gmxEcosystem!.fsGlp.address.toLowerCase()}>`,
      );
      await expectThrow(
        ytGlpOracle.getPrice(core.tokens.dfsGlp!.address),
        `PendleYtGLPPriceOracle: Invalid token <${core.tokens.dfsGlp!.address.toLowerCase()}>`,
      );
      await expectThrow(
        ytGlpOracle.getPrice(core.gmxEcosystem!.glp.address),
        `PendleYtGLPPriceOracle: Invalid token <${core.gmxEcosystem!.glp.address.toLowerCase()}>`,
      );
    });

    it('fails when ytGLP is borrowable', async () => {
      await core.dolomiteMargin.ownerSetIsClosing(marketId, false);
      await expectThrow(
        ytGlpOracle.getPrice(factory.address),
        'PendleYtGLPPriceOracle: ytGLP cannot be borrowable',
      );
    });
  });
});
