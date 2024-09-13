import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { mine } from '@nomicfoundation/hardhat-network-helpers';
import { setNextBlockTimestamp } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber, revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';
import { createDolomiteRegistryImplementation } from 'packages/base/test/utils/dolomite';
import {
  getDefaultCoreProtocolConfigForGmxV2,
  setupCoreProtocol,
  setupTestMarket,
} from 'packages/base/test/utils/setup';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { GlvIsolationModeUnwrapperTraderV2, GlvIsolationModeVaultFactory, GlvIsolationModeWrapperTraderV2, GlvRegistry, GlvTokenPriceOracle, IGlvToken } from '../src/types';
import { IGmxMarketToken } from 'packages/gmx-v2/src/types';
import { createGlvIsolationModeTokenVaultV1, createGlvIsolationModeUnwrapperTraderV2, createGlvIsolationModeVaultFactory, createGlvIsolationModeWrapperTraderV2, createGlvLibrary, createGlvRegistry, createGlvTokenPriceOracle } from './glv-ecosystem-utils';
import { createGmxV2Library, createGmxV2MarketTokenPriceOracle } from 'packages/gmx-v2/test/gmx-v2-ecosystem-utils';
import { createSafeDelegateLibrary } from 'packages/base/test/utils/ecosystem-utils/general';
import { GMX_V2_EXECUTION_FEE_FOR_TESTS } from 'packages/gmx-v2/src/gmx-v2-constructors';

const GM_ETH_USD_PRICE_NO_MAX_WEI = BigNumber.from('1429636905295331641'); // $1.4292
const MAX_WEI = BigNumber.from('10000000000000000000000000'); // 10M tokens
const NEGATIVE_PRICE = BigNumber.from('-5');
const FEE_BASIS_POINTS = BigNumber.from('7');
const BASIS_POINTS = BigNumber.from('10000');
const GMX_DECIMAL_ADJUSTMENT = BigNumber.from('1000000000000');
const NEXT_TIMESTAMP = 1724776050;

const executionFee =
  process.env.COVERAGE !== 'true' ? GMX_V2_EXECUTION_FEE_FOR_TESTS : GMX_V2_EXECUTION_FEE_FOR_TESTS.mul(10);
const gasLimit = process.env.COVERAGE !== 'true' ? 30_000_000 : 100_000_000; // @follow-up Check if this is ok
const callbackGasLimit =
  process.env.COVERAGE !== 'true' ? BigNumber.from('3000000') : BigNumber.from('3000000').mul(10);

describe('GlvTokenPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: IGlvToken;
  let gmMarketToken: IGmxMarketToken;
  let allowableMarketIds: BigNumberish[];
  let glvPriceOracle: GlvTokenPriceOracle;
  let glvRegistry: GlvRegistry;
  let factory: GlvIsolationModeVaultFactory;
  let wrapper: GlvIsolationModeWrapperTraderV2;
  let unwrapper: GlvIsolationModeUnwrapperTraderV2;
  let marketId: BigNumberish;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: await getRealLatestBlockNumber(true, Network.ArbitrumOne),
      network: Network.ArbitrumOne
    });
    underlyingToken = core.glvEcosystem.glvTokens.wethUsdc.glvToken.connect(core.hhUser1);
    gmMarketToken = core.gmxV2Ecosystem.gmTokens.ethUsd.marketToken;

    await setupNewOracleAggregatorTokens(core);

    const glvLibrary = await createGlvLibrary();
    const gmxV2Library = await createGmxV2Library();
    const safeDelegateCallLibrary = await createSafeDelegateLibrary();
    glvRegistry = await createGlvRegistry(core, gmMarketToken, callbackGasLimit);
    const newRegistry = await createDolomiteRegistryImplementation();
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(newRegistry.address);

    const userVaultImplementation = await createGlvIsolationModeTokenVaultV1(core, glvLibrary, gmxV2Library);

    allowableMarketIds = [core.marketIds.nativeUsdc, core.marketIds.weth];
    factory = await createGlvIsolationModeVaultFactory(
      core,
      gmxV2Library,
      glvRegistry,
      allowableMarketIds,
      allowableMarketIds,
      core.glvEcosystem.glvTokens.wethUsdc,
      userVaultImplementation,
      executionFee,
    );
    unwrapper = await createGlvIsolationModeUnwrapperTraderV2(core, factory, glvLibrary, gmxV2Library, glvRegistry);
    wrapper = await createGlvIsolationModeWrapperTraderV2(core, factory, glvLibrary, gmxV2Library, glvRegistry);

    glvPriceOracle = await createGlvTokenPriceOracle(core, glvRegistry);

    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, glvPriceOracle);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    await glvRegistry.connect(core.governance).ownerSetUnwrapperByToken(factory.address, unwrapper.address);
    await glvRegistry.connect(core.governance).ownerSetWrapperByToken(factory.address, wrapper.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe.only('#constructor', () => {
    it('should work normally', async () => {
      expect(await glvPriceOracle.REGISTRY()).to.eq(glvRegistry.address);
      expect(await glvPriceOracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });
  });

  // describe('#getFeeBpByMarketToken', () => {
  //   it('should work normally', async () => {
  //     expect(await gmPriceOracle.getFeeBpByMarketToken(core.gmxV2Ecosystem.gmxEthUsdMarketToken.address)).to.eq(
  //       FEE_BASIS_POINTS,
  //     );
  //   });
  // });

  describe('#getPrice', () => {
    it.only('returns the correct value when there is no max wei', async () => {
      // Have to be at specific timestamp to get consistent price
      // Setup core protocol sometimes ends at different timestamps which threw off the test
      // await setNextBlockTimestamp(NEXT_TIMESTAMP);
      // await mine();
      expect((await glvPriceOracle.getPrice(factory.address)).value).to.eq(1);
    });

    it('returns the correct value when there is a max wei', async () => {
      // Have to be at specific timestamp to get consistent price
      // Setup core protocol sometimes ends at different timestamps which threw off the test
      await core.dolomiteMargin.ownerSetMaxWei(marketId, MAX_WEI); // 10M tokens
      await setNextBlockTimestamp(NEXT_TIMESTAMP);
      await mine();
      // Should be same as above as we no longer factor it into slippage
      expect((await gmPriceOracle.getPrice(factory.address)).value).to.eq(GM_ETH_USD_PRICE_NO_MAX_WEI);
    });

    it('returns the correct value when there is a max wei & 0 price impact', async () => {
      // Have to be at specific timestamp to get consistent price
      // Setup core protocol sometimes ends at different timestamps which threw off the test
      await core.dolomiteMargin.ownerSetMaxWei(marketId, MAX_WEI); // 10M tokens
      await gmxV2Registry.connect(core.governance).ownerSetGmxReader(testReader.address);
      const price = BigNumber.from('1000000000000000000000000000000');
      await testReader.setMarketPrice(price);
      await setNextBlockTimestamp(NEXT_TIMESTAMP);
      await mine();
      expect((await gmPriceOracle.getPrice(factory.address)).value).to.eq(
        price.mul(BASIS_POINTS.sub(FEE_BASIS_POINTS)).div(BASIS_POINTS).div(GMX_DECIMAL_ADJUSTMENT),
      );
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

async function setupNewOracleAggregatorTokens(core: CoreProtocolArbitrumOne) {
    await core.chainlinkPriceOracleV3.ownerInsertOrUpdateOracleToken(
      '0x7D7F1765aCbaF847b9A1f7137FE8Ed4931FbfEbA', // ATOM - good
      '0xCDA67618e51762235eacA373894F0C79256768fa',
      false
    );
    await core.oracleAggregatorV2.ownerInsertOrUpdateToken({
      oracleInfos: [{
        oracle: core.chainlinkPriceOracleV3.address,
        tokenPair: ADDRESS_ZERO,
        weight: 100
      }],
      token: '0x7D7F1765aCbaF847b9A1f7137FE8Ed4931FbfEbA',
      decimals: 6
    });

    await core.chainlinkPriceOracleV3.ownerInsertOrUpdateOracleToken(
      '0xC4da4c24fd591125c3F47b340b6f4f76111883d8', // DOGE - good
      '0x9A7FB1b3950837a8D9b40517626E11D4127C098C',
      false
    );
    await core.oracleAggregatorV2.ownerInsertOrUpdateToken({
      oracleInfos: [{
        oracle: core.chainlinkPriceOracleV3.address,
        tokenPair: ADDRESS_ZERO,
        weight: 100
      }],
      token: '0xC4da4c24fd591125c3F47b340b6f4f76111883d8',
      decimals: 8
    });


    await core.chainlinkPriceOracleV3.ownerInsertOrUpdateOracleToken(
      '0x1FF7F3EFBb9481Cbd7db4F932cBCD4467144237C', // NEAR - good
      '0xBF5C3fB2633e924598A46B9D07a174a9DBcF57C0',
      false
    );
    await core.oracleAggregatorV2.ownerInsertOrUpdateToken({
      oracleInfos: [{
        oracle: core.chainlinkPriceOracleV3.address,
        tokenPair: ADDRESS_ZERO,
        weight: 100
      }],
      token: '0x1FF7F3EFBb9481Cbd7db4F932cBCD4467144237C',
      decimals: 24
    });

    await core.chainlinkPriceOracleV3.ownerInsertOrUpdateOracleToken(
      '0xc14e065b0067dE91534e032868f5Ac6ecf2c6868', // XRP
      '0xB4AD57B52aB9141de9926a3e0C8dc6264c2ef205',
      false
    );
    await core.oracleAggregatorV2.ownerInsertOrUpdateToken({
      oracleInfos: [{
        oracle: core.chainlinkPriceOracleV3.address,
        tokenPair: ADDRESS_ZERO,
        weight: 100
      }],
      token: '0xc14e065b0067dE91534e032868f5Ac6ecf2c6868',
      decimals: 6
    });

    await core.chainlinkPriceOracleV3.ownerInsertOrUpdateOracleToken(
      '0xB46A094Bc4B0adBD801E14b9DB95e05E28962764', // LTC
      '0x5698690a7B7B84F6aa985ef7690A8A7288FBc9c8',
      false
    );
    await core.oracleAggregatorV2.ownerInsertOrUpdateToken({
      oracleInfos: [{
        oracle: core.chainlinkPriceOracleV3.address,
        tokenPair: ADDRESS_ZERO,
        weight: 100
      }],
      token: '0xB46A094Bc4B0adBD801E14b9DB95e05E28962764',
      decimals: 8
    });

    // await core.chainlinkPriceOracleV3.ownerInsertOrUpdateOracleToken(
    //   '0x3E57D02f9d196873e55727382974b02EdebE6bfd', // SHIB
    //   '',
    //   false
    // );
    // await core.oracleAggregatorV2.ownerInsertOrUpdateToken({
    //   oracleInfos: [{
    //     oracle: core.chainlinkPriceOracleV3.address,
    //     tokenPair: ADDRESS_ZERO,
    //     weight: 100
    //   }],
    //   token: '0x3E57D02f9d196873e55727382974b02EdebE6bfd',
    //   decimals: 24
    // });
}