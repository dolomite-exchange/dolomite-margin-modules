import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  getBlockTimestamp,
  increaseToTimestamp,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import {
  setupCoreProtocol,
  setupTestMarket,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import {
  IERC20,
  IPendleYtToken,
  PendleRegistry,
  PendleYtIsolationModeVaultFactory,
  PendleYtPriceOracle,
  TestPendlePtOracle,
  TestPendlePtOracle__factory,
} from '../../src/types';
import {
  createPendleRegistry,
  createPendleYtIsolationModeTokenVaultV1,
  createPendleYtIsolationModeVaultFactory,
  createPendleYtPriceOracle,
} from '../pendle-ecosystem-utils';

/**
 * This is the expected price at the following timestamp: 1690134516
 *
 * Keep in mind that Pendle's PT prices tick upward each second so YT prices tick downward
 */
const PT_WE_ETH_PRICE = BigNumber.from('2898346570294502928507'); // $2898.346570294502928507
const YT_WE_ETH_PRICE = BigNumber.from('98026451700623839284'); // $98.026451700623839284
const WE_ETH_PRICE = BigNumber.from('3104904654546013991400'); // $3,104.904654546013991400
const initialAllowableDebtMarketIds = [0, 1];
const initialAllowableCollateralMarketIds = [2, 3];

describe('PendleYtEEthJun2024PriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: IERC20;
  let underlyingYtToken: IPendleYtToken;
  let priceOracle: PendleYtPriceOracle;
  let pendleRegistry: PendleRegistry;
  let factory: PendleYtIsolationModeVaultFactory;
  let marketId: BigNumberish;
  let timestampTeleport: number;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 207_166_000,
      network: Network.ArbitrumOne,
    });
    const timestamp = await getBlockTimestamp(207_166_000);
    timestampTeleport = timestamp + 600; // add 10 minutes
    underlyingToken = core.tokens.weEth;
    underlyingYtToken = core.pendleEcosystem!.weEthJun2024.ytWeEthToken;

    const userVaultImplementation = await createPendleYtIsolationModeTokenVaultV1();
    pendleRegistry = await createPendleRegistry(
      core,
      core.pendleEcosystem!.weEthJun2024.weEthMarket,
      core.pendleEcosystem!.weEthJun2024.ptOracle,
      core.pendleEcosystem!.syWeEthToken,
    );
    factory = await createPendleYtIsolationModeVaultFactory(
      core,
      pendleRegistry,
      initialAllowableDebtMarketIds,
      [],
      underlyingYtToken,
      userVaultImplementation,
    );
    priceOracle = await createPendleYtPriceOracle(core, factory, pendleRegistry, underlyingToken);

    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('constructor', () => {
    it('should work normally', async () => {
      expect(await priceOracle.DYT_TOKEN()).to.eq(factory.address);
      expect(await priceOracle.REGISTRY()).to.eq(pendleRegistry.address);
      expect(await priceOracle.UNDERLYING_TOKEN()).to.eq(core.tokens.weEth.address);
      expect(await priceOracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
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
        createPendleYtPriceOracle(core, factory, pendleRegistry, underlyingToken),
        'PendleYtPriceOracle: Oracle not ready yet',
      );
      await testPtOracle.setOracleState(false, 0, false);
      await expectThrow(
        createPendleYtPriceOracle(core, factory, pendleRegistry, underlyingToken),
        'PendleYtPriceOracle: Oracle not ready yet',
      );

      await testPtOracle.setOracleState(true, 0, true);
      await expectThrow(
        createPendleYtPriceOracle(core, factory, pendleRegistry, underlyingToken),
        'PendleYtPriceOracle: Oracle not ready yet',
      );

      await testPtOracle.setOracleState(false, 0, true);
      await createPendleYtPriceOracle(core, factory, pendleRegistry, underlyingToken); // should work now
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value under normal conditions for dyToken', async () => {
      await increaseToTimestamp(timestampTeleport);
      const eEthPrice = (await core.oracleAggregatorV2.getPrice(core.tokens.eEth.address)).value;
      expect((await core.dolomiteMargin.getMarketPrice(core.marketIds.weEth)).value).to.eq(WE_ETH_PRICE);
      expect((await core.dolomiteMargin.getMarketPrice(core.marketIds.dPtWeEthJun2024)).value).to.eq(PT_WE_ETH_PRICE);
      expect((await priceOracle.getPrice(factory.address)).value).to.eq(YT_WE_ETH_PRICE);

      // Verify the two equal each other, roughly. YT_GLP is rounded down because of decimal truncation
      // @follow-up I think this is off because eEth and weEth exchange rate stuff
      expect(eEthPrice.sub(PT_WE_ETH_PRICE).sub(1)).to.eq(YT_WE_ETH_PRICE);
    });

    // @follow-up Any good idea how to test these now that aggregator is used in the solidity code
    xit('returns 1 instead of 0 after maturity for dytToken', async () => {
      await increaseToTimestamp((await core.pendleEcosystem.weEthJun2024.ytWeEthToken.expiry()).toNumber() + 1);
      expect((await priceOracle.getPrice(factory.address)).value).to.eq(1);
    });

    it('fails when token sent is not dytToken', async () => {
      await expectThrow(
        priceOracle.getPrice(ADDRESSES.ZERO),
        `PendleYtPriceOracle: Invalid token <${ADDRESSES.ZERO}>`,
      );
      await expectThrow(
        priceOracle.getPrice(core.gmxEcosystem!.fsGlp.address),
        `PendleYtPriceOracle: Invalid token <${core.gmxEcosystem!.fsGlp.address.toLowerCase()}>`,
      );
      await expectThrow(
        priceOracle.getPrice(core.tokens.dfsGlp!.address),
        `PendleYtPriceOracle: Invalid token <${core.tokens.dfsGlp!.address.toLowerCase()}>`,
      );
      await expectThrow(
        priceOracle.getPrice(core.gmxEcosystem!.glp.address),
        `PendleYtPriceOracle: Invalid token <${core.gmxEcosystem!.glp.address.toLowerCase()}>`,
      );
    });

    it('fails when ytToken is borrowable', async () => {
      await core.dolomiteMargin.ownerSetIsClosing(marketId, false);
      await expectThrow(
        priceOracle.getPrice(factory.address),
        'PendleYtPriceOracle: YT cannot be borrowable',
      );
    });
  });

  describe('#ownerSetDeductionCoefficient', () => {
    it('should work normally', async () => {
      const result = await priceOracle.connect(core.governance).ownerSetDeductionCoefficient(100);
      await expectEvent(priceOracle, result, 'DeductionCoefficientSet', {
        deductionCoefficient: 100,
      });
      expect(await priceOracle.deductionCoefficient()).to.eq(100);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        priceOracle.connect(core.hhUser1).ownerSetDeductionCoefficient(100),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});
