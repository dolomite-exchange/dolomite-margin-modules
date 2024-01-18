import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { mine } from '@nomicfoundation/hardhat-network-helpers';
import { setNextBlockTimestamp } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import {
  GmxV2IsolationModeUnwrapperTraderV2,
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeWrapperTraderV2,
  GmxV2MarketTokenPriceOracle,
  GmxV2Registry,
  TestGmxReader,
  TestGmxReader__factory,
} from 'src/types';
import { createContractWithAbi } from 'src/utils/dolomite-utils';
import { Network, ZERO_BI } from 'src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'test/utils';
import { expectEvent, expectThrow } from 'test/utils/assertions';
import {
  createGmxV2IsolationModeTokenVaultV1,
  createGmxV2IsolationModeUnwrapperTraderV2,
  createGmxV2IsolationModeVaultFactory,
  createGmxV2IsolationModeWrapperTraderV2,
  createGmxV2Library,
  createGmxV2MarketTokenPriceOracle,
  createGmxV2Registry,
} from 'test/utils/ecosystem-token-utils/gmx';
import { CoreProtocol, setupCoreProtocol, setupTestMarket } from 'packages/base/test/utils/setup';
import { GMX_V2_CALLBACK_GAS_LIMIT, GMX_V2_EXECUTION_FEE } from '../../../src/utils/constructors/gmx';

const GM_ETH_USD_PRICE_NO_MAX_WEI = BigNumber.from('919979975416060612'); // $0.9199
const GM_ETH_USD_PRICE_MAX_WEI = BigNumber.from('918897815809950545'); // $0.9188
const MAX_WEI = BigNumber.from('10000000000000000000000000'); // 10M tokens
const NEGATIVE_PRICE = BigNumber.from('-5');
const FEE_BASIS_POINTS = BigNumber.from('7');
const BASIS_POINTS = BigNumber.from('10000');
const GMX_DECIMAL_ADJUSTMENT = BigNumber.from('1000000000000');
const blockNumber = 128_276_157;

describe('GmxV2MarketTokenPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let allowableMarketIds: BigNumberish[];
  let gmPriceOracle: GmxV2MarketTokenPriceOracle;
  let gmxV2Registry: GmxV2Registry;
  let factory: GmxV2IsolationModeVaultFactory;
  let wrapper: GmxV2IsolationModeWrapperTraderV2;
  let unwrapper: GmxV2IsolationModeUnwrapperTraderV2;
  let marketId: BigNumberish;
  let testReader: TestGmxReader;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber,
      network: Network.ArbitrumOne,
    });
    gmxV2Registry = await createGmxV2Registry(core, GMX_V2_CALLBACK_GAS_LIMIT);
    const gmxV2Library = await createGmxV2Library();
    const userVaultImplementation = await createGmxV2IsolationModeTokenVaultV1(core, gmxV2Library);

    allowableMarketIds = [core.marketIds.nativeUsdc!, core.marketIds.weth];
    factory = await createGmxV2IsolationModeVaultFactory(
      core,
      gmxV2Library,
      gmxV2Registry,
      allowableMarketIds,
      allowableMarketIds,
      core.gmxEcosystemV2!.gmxEthUsdMarketToken,
      userVaultImplementation,
      GMX_V2_EXECUTION_FEE,
    );
    unwrapper = await createGmxV2IsolationModeUnwrapperTraderV2(
      core,
      factory,
      gmxV2Library,
      gmxV2Registry,
    );
    wrapper = await createGmxV2IsolationModeWrapperTraderV2(
      core,
      factory,
      gmxV2Library,
      gmxV2Registry,
    );

    gmPriceOracle = await createGmxV2MarketTokenPriceOracle(core, gmxV2Registry);
    await gmPriceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, gmPriceOracle);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    await gmxV2Registry.connect(core.governance).ownerSetUnwrapperByToken(factory.address, unwrapper.address);
    await gmxV2Registry.connect(core.governance).ownerSetWrapperByToken(factory.address, wrapper.address);

    testReader = await createContractWithAbi(
      TestGmxReader__factory.abi,
      TestGmxReader__factory.bytecode,
      [],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await gmPriceOracle.marketTokens(factory.address)).to.eq(true);
      expect(await gmPriceOracle.REGISTRY()).to.eq(gmxV2Registry.address);
      expect(await gmPriceOracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });
  });

  describe('#getFeeBpByMarketToken', () => {
    it('should work normally', async () => {
      expect(await gmPriceOracle.getFeeBpByMarketToken(core.gmxEcosystemV2!.gmxEthUsdMarketToken.address))
        .to
        .eq(FEE_BASIS_POINTS);
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value when there is no max wei', async () => {
      // Have to be at specific timestamp to get consistent price
      // Setup core protocol sometimes ends at different timestamps which threw off the test
      await setNextBlockTimestamp(1693923100);
      await mine();
      expect((await gmPriceOracle.getPrice(factory.address)).value).to.eq(GM_ETH_USD_PRICE_NO_MAX_WEI);
    });

    it('returns the correct value when there is a max wei', async () => {
      // Have to be at specific timestamp to get consistent price
      // Setup core protocol sometimes ends at different timestamps which threw off the test
      await core.dolomiteMargin.ownerSetMaxWei(marketId, MAX_WEI); // 10M tokens
      await setNextBlockTimestamp(1693923100);
      await mine();
      expect((await gmPriceOracle.getPrice(factory.address)).value).to.eq(GM_ETH_USD_PRICE_MAX_WEI);
    });

    it('returns the correct value when there is a max wei & 0 price impact', async () => {
      // Have to be at specific timestamp to get consistent price
      // Setup core protocol sometimes ends at different timestamps which threw off the test
      await core.dolomiteMargin.ownerSetMaxWei(marketId, MAX_WEI); // 10M tokens
      await gmxV2Registry.connect(core.governance).ownerSetGmxReader(testReader.address);
      const price = BigNumber.from('1000000000000000000000000000000');
      await testReader.setMarketPrice(price);
      await setNextBlockTimestamp(1693923100);
      await mine();
      expect((await gmPriceOracle.getPrice(factory.address)).value)
        .to
        .eq(price.mul(BASIS_POINTS.sub(FEE_BASIS_POINTS)).div(BASIS_POINTS).div(GMX_DECIMAL_ADJUSTMENT));
    });

    it('should fail when token sent is not a valid token', async () => {
      await expectThrow(
        gmPriceOracle.getPrice(ADDRESSES.ZERO),
        `GmxV2MarketTokenPriceOracle: Invalid token <${ADDRESSES.ZERO}>`,
      );
      await expectThrow(
        gmPriceOracle.getPrice(core.tokens.usdc.address),
        `GmxV2MarketTokenPriceOracle: Invalid token <${core.tokens.usdc.address.toLowerCase()}>`,
      );
    });

    it('should fail when GM token is borrowable', async () => {
      await core.dolomiteMargin.ownerSetIsClosing(marketId, false);
      await expectThrow(
        gmPriceOracle.getPrice(factory.address),
        'GmxV2MarketTokenPriceOracle: gmToken cannot be borrowable',
      );
    });

    it('should fail if GMX Reader returns a negative number or zero', async () => {
      await gmxV2Registry.connect(core.governance).ownerSetGmxReader(testReader.address);
      await testReader.setMarketPrice(NEGATIVE_PRICE);
      await expectThrow(
        gmPriceOracle.getPrice(factory.address),
        'GmxV2MarketTokenPriceOracle: Invalid oracle response',
      );

      await testReader.setMarketPrice(ZERO_BI);
      await expectThrow(
        gmPriceOracle.getPrice(factory.address),
        'GmxV2MarketTokenPriceOracle: Invalid oracle response',
      );
    });
  });

  describe('#ownerSetMarketToken', () => {
    it('should work normally', async () => {
      const result = await gmPriceOracle.connect(core.governance).ownerSetMarketToken(factory.address, false);
      await expectEvent(gmPriceOracle, result, 'MarketTokenSet', {
        token: factory.address,
        status: false,
      });
      expect(await gmPriceOracle.marketTokens(factory.address)).to.eq(false);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        gmPriceOracle.connect(core.hhUser1).ownerSetMarketToken(core.tokens.weth.address, true),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if token does not have 18 decimals', async () => {
      await expectThrow(
        gmPriceOracle.connect(core.governance).ownerSetMarketToken(core.tokens.usdc.address, true),
        'GmxV2MarketTokenPriceOracle: Invalid market token decimals',
      );
    });
  });
});
