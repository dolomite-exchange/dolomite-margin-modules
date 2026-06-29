import {
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
} from '@dolomite-exchange/modules-base/src/types';
import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { MAX_UINT_112_BI, Network, ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { DOLO_WBERA_KODIAK_POOL_MAP, IBERA_WBERA_KODIAK_POOL_MAP } from 'packages/base/src/utils/constants';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  PancakeV3PriceOracleWithModifiers,
  PancakeV3PriceOracleWithModifiers__factory,
  TestPancakeV3Pair,
  TestPancakeV3Pair__factory,
} from '../src/types';

const FIFTEEN_MINUTES = BigNumber.from('900');

const DOLO_TOKEN_INFO: PancakeV3PriceOracleWithModifiers.TokenInfoStruct = {
  pair: DOLO_WBERA_KODIAK_POOL_MAP[Network.Berachain],
  decimals: 18,
  observationInterval: FIFTEEN_MINUTES,
  minPrice: 1,
  maxPrice: MAX_UINT_112_BI.sub(1),
};

const IBERA_TOKEN_INFO: PancakeV3PriceOracleWithModifiers.TokenInfoStruct = {
  pair: IBERA_WBERA_KODIAK_POOL_MAP[Network.Berachain],
  decimals: 18,
  observationInterval: FIFTEEN_MINUTES,
  minPrice: ONE_ETH_BI.mul(8).div(10),
  maxPrice: ONE_ETH_BI.mul(12).div(10),
};

const WBERA_PRICE = BigNumber.from('226734410000000000');
const ROUNDING = BigNumber.from('100000000000000');
const ROUNDING_SM = BigNumber.from('100000000000');

describe('PancakeV3PriceOracleWithModifiers', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let oracle: PancakeV3PriceOracleWithModifiers;
  let mockPool: TestPancakeV3Pair;

  before(async () => {
    const blockNumber = 22_580_000;
    core = await setupCoreProtocol({
      blockNumber,
      network: Network.Berachain,
    });

    expect((await core.dolomiteMargin.getMarketPrice(core.marketIds.wbera)).value).to.eq(WBERA_PRICE);

    const dolomiteRegistryImplementation = await createContractWithAbi<DolomiteRegistryImplementation>(
      DolomiteRegistryImplementation__factory.abi,
      DolomiteRegistryImplementation__factory.bytecode,
      [],
    );
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(dolomiteRegistryImplementation.address);

    oracle = await createContractWithAbi<PancakeV3PriceOracleWithModifiers>(
      PancakeV3PriceOracleWithModifiers__factory.abi,
      PancakeV3PriceOracleWithModifiers__factory.bytecode,
      [core.dolomiteRegistry.address, core.dolomiteMargin.address],
    );

    mockPool = await createContractWithAbi<TestPancakeV3Pair>(
      TestPancakeV3Pair__factory.abi,
      TestPancakeV3Pair__factory.bytecode,
      [],
    );

    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
      token: core.tokens.dolo.address,
      decimals: 18,
      oracleInfos: [{ oracle: oracle.address, tokenPair: core.tokens.wbera.address, weight: 100 }],
    });
    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
      token: core.tokens.iBera.address,
      decimals: 18,
      oracleInfos: [{ oracle: oracle.address, tokenPair: core.tokens.wbera.address, weight: 100 }],
    });

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await oracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await oracle.DOLOMITE_REGISTRY()).to.eq(core.dolomiteRegistry.address);
    });
  });

  describe('#ownerSetTokenInfo', () => {
    it('works normally', async () => {
      await mockPool.setTokens(core.tokens.dolo.address, core.tokens.wbera.address);
      const tokenInfo = { ...DOLO_TOKEN_INFO, pair: mockPool.address };
      await oracle.connect(core.governance).ownerSetTokenInfo(core.tokens.dolo.address, tokenInfo);

      const info = await oracle.getTokenInfo(core.tokens.dolo.address);
      expect(info.pair).to.eq(mockPool.address);
      expect(info.decimals).to.eq(DOLO_TOKEN_INFO.decimals);
      expect(info.observationInterval).to.eq(DOLO_TOKEN_INFO.observationInterval);
      expect(info.minPrice).to.eq(DOLO_TOKEN_INFO.minPrice);
      expect(info.maxPrice).to.eq(DOLO_TOKEN_INFO.maxPrice);
    });

    it('fails when the token is not in the pair', async () => {
      await mockPool.setTokens(core.tokens.weth.address, core.tokens.wbera.address);
      const tokenInfo = { ...DOLO_TOKEN_INFO, pair: mockPool.address };
      await expectThrow(
        oracle.connect(core.governance).ownerSetTokenInfo(core.tokens.dolo.address, tokenInfo),
        'PancakeV3PriceOracleWithModifier: Invalid pair',
      );
    });

    it('fails when decimals are 0', async () => {
      await mockPool.setTokens(core.tokens.dolo.address, core.tokens.wbera.address);
      const tokenInfo = { ...DOLO_TOKEN_INFO, pair: mockPool.address, decimals: 0 };
      await expectThrow(
        oracle.connect(core.governance).ownerSetTokenInfo(core.tokens.dolo.address, tokenInfo),
        'PancakeV3PriceOracleWithModifier: Invalid decimals',
      );
    });

    it('fails when decimals are greater than 18', async () => {
      await mockPool.setTokens(core.tokens.dolo.address, core.tokens.wbera.address);
      const tokenInfo = { ...DOLO_TOKEN_INFO, pair: mockPool.address, decimals: 19 };
      await expectThrow(
        oracle.connect(core.governance).ownerSetTokenInfo(core.tokens.dolo.address, tokenInfo),
        'PancakeV3PriceOracleWithModifier: Invalid decimals',
      );
    });

    it('fails when min price is 0', async () => {
      await mockPool.setTokens(core.tokens.dolo.address, core.tokens.wbera.address);
      const tokenInfo = { ...DOLO_TOKEN_INFO, pair: mockPool.address, minPrice: 0 };
      await expectThrow(
        oracle.connect(core.governance).ownerSetTokenInfo(core.tokens.dolo.address, tokenInfo),
        'PancakeV3PriceOracleWithModifier: Invalid min or max price',
      );
    });

    it('fails when max price is too large', async () => {
      await mockPool.setTokens(core.tokens.dolo.address, core.tokens.wbera.address);
      const tokenInfo = { ...DOLO_TOKEN_INFO, pair: mockPool.address, maxPrice: MAX_UINT_112_BI };
      await expectThrow(
        oracle.connect(core.governance).ownerSetTokenInfo(core.tokens.dolo.address, tokenInfo),
        'PancakeV3PriceOracleWithModifier: Invalid min or max price',
      );
    });

    it('fails when min price is greater than max price', async () => {
      await mockPool.setTokens(core.tokens.dolo.address, core.tokens.wbera.address);
      const tokenInfo = { ...DOLO_TOKEN_INFO, pair: mockPool.address, minPrice: 100, maxPrice: 50 };
      await expectThrow(
        oracle.connect(core.governance).ownerSetTokenInfo(core.tokens.dolo.address, tokenInfo),
        'PancakeV3PriceOracleWithModifier: Min and max price cross',
      );
    });

    it('fails when observation interval is too small', async () => {
      await mockPool.setTokens(core.tokens.dolo.address, core.tokens.wbera.address);
      const tokenInfo = { ...DOLO_TOKEN_INFO, pair: mockPool.address, observationInterval: 899 };
      await expectThrow(
        oracle.connect(core.governance).ownerSetTokenInfo(core.tokens.dolo.address, tokenInfo),
        'PancakeV3PriceOracleWithModifier: Invalid observation interval',
      );
    });

    it('fails when invoked by non-admin', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).ownerSetTokenInfo(core.tokens.dolo.address, DOLO_TOKEN_INFO),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#getPrice', () => {
    it('should work normally when output token is token1', async () => {
      // DOLO is token0, WBERA is token1
      await oracle.connect(core.governance).ownerSetTokenInfo(core.tokens.dolo.address, DOLO_TOKEN_INFO);
      const price = await core.oracleAggregatorV2.getPrice(core.tokens.dolo.address);
      expect(price.value.div(ROUNDING_SM)).to.eq(BigNumber.from('23993708016820390').div(ROUNDING_SM));
    });

    it('should work normally when output token is token0', async () => {
      // WBERA is token0, IBERA is token1
      await oracle.connect(core.governance).ownerSetTokenInfo(core.tokens.iBera.address, IBERA_TOKEN_INFO);
      const price = await core.oracleAggregatorV2.getPrice(core.tokens.iBera.address);
      expect(price.value).to.eq(WBERA_PRICE.mul('1042683741645484896').div(ONE_ETH_BI));
    });

    it('should work normally when price is higher than 1', async () => {
      await mockPool.setTokens(core.tokens.dolo.address, core.tokens.wbera.address);
      const tokenInfo = { ...DOLO_TOKEN_INFO, pair: mockPool.address };
      await oracle.connect(core.governance).ownerSetTokenInfo(core.tokens.dolo.address, tokenInfo);

      // tick 6931 => price ~2
      await mockPool.setTickCumulatives([0, 6931 * FIFTEEN_MINUTES.toNumber()]);
      const price = await core.oracleAggregatorV2.getPrice(core.tokens.dolo.address);
      expect(price.value.div(ROUNDING)).to.eq(WBERA_PRICE.mul(2).div(ROUNDING));
    });

    it('should fail if invalid token is passed', async () => {
      await expectThrow(
        oracle.getPrice(core.tokens.weth.address),
        `PancakeV3PriceOracleWithModifier: Invalid token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if price is too low', async () => {
      await mockPool.setTokens(core.tokens.wbera.address, core.tokens.iBera.address);
      const tokenInfo = { ...IBERA_TOKEN_INFO, pair: mockPool.address };
      await oracle.connect(core.governance).ownerSetTokenInfo(core.tokens.iBera.address, tokenInfo);

      // tick 3000 => price is high (iBera > wbera), but since iBera is token1, tick 3000 means iBera is cheap?
      // P = 1.0001^tick. If tick > 0, token1/token0 is small, token0/token1 is large.
      // We want price of iBera (token1) to be low.
      // Price of token1 in terms of token0 is 1.0001^-tick.
      // To get price < 0.8, we need 1.0001^-tick < 0.8 => -tick * ln(1.0001) < ln(0.8)
      // => tick > -ln(0.8)/ln(1.0001) ~ 2231
      await mockPool.setTickCumulatives([0, 3000 * FIFTEEN_MINUTES.toNumber()]);
      await expectThrow(
        core.oracleAggregatorV2.getPrice(core.tokens.iBera.address),
        'PancakeV3PriceOracleWithModifier: Price too low',
      );
    });

    it('should fail if price is too large', async () => {
      await mockPool.setTokens(core.tokens.wbera.address, core.tokens.iBera.address);
      const tokenInfo = { ...IBERA_TOKEN_INFO, pair: mockPool.address };
      await oracle.connect(core.governance).ownerSetTokenInfo(core.tokens.iBera.address, tokenInfo);

      // To get price > 1.2, we need 1.0001^-tick > 1.2 => -tick > ln(1.2)/ln(1.0001) ~ 1823 => tick < -1823
      await mockPool.setTickCumulatives([0, -3000 * FIFTEEN_MINUTES.toNumber()]);
      await expectThrow(
        core.oracleAggregatorV2.getPrice(core.tokens.iBera.address),
        'PancakeV3PriceOracleWithModifier: Price too large',
      );
    });
  });
});
