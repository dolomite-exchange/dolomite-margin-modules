import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { MAX_UINT_112_BI, Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  CamelotV3PriceOracleWithModifiers,
  CamelotV3PriceOracleWithModifiers__factory,
  TestPancakeV3Pair,
  TestPancakeV3Pair__factory,
} from '../src/types';
import { parseEther } from 'ethers/lib/utils';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';

const FIFTEEN_MINUTES = BigNumber.from('900');

const GRAIL_TOKEN_INFO: CamelotV3PriceOracleWithModifiers.TokenInfoStruct = {
  pair: "0x8cc8093218bCaC8B1896A1EED4D925F6F6aB289F",
  decimals: 18,
  observationInterval: FIFTEEN_MINUTES,
  minPrice: parseEther('35'),
  maxPrice: parseEther('55'),
};

const GRAIL_PRICE = BigNumber.from('45206567004063640979');

describe('CamelotV3PriceOracleWithModifiers', () => {

  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let oracle: CamelotV3PriceOracleWithModifiers;
  let mockPool: TestPancakeV3Pair;

  before(async () => {
    const blockNumber = 478_637_000;
    core = await setupCoreProtocol({
      blockNumber,
      network: Network.ArbitrumOne,
    });

    expect((await core.dolomiteMargin.getMarketPrice(core.marketIds.grail)).value).to.eq(GRAIL_PRICE);

    oracle = await createContractWithAbi<CamelotV3PriceOracleWithModifiers>(
      CamelotV3PriceOracleWithModifiers__factory.abi,
      CamelotV3PriceOracleWithModifiers__factory.bytecode,
      [core.dolomiteRegistry.address, core.dolomiteMargin.address],
    );

    mockPool = await createContractWithAbi<TestPancakeV3Pair>(
      TestPancakeV3Pair__factory.abi,
      TestPancakeV3Pair__factory.bytecode,
      [],
    );
      
    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
      token: core.tokens.grail.address,
      decimals: 18,
      oracleInfos: [{ oracle: oracle.address, tokenPair: core.tokens.usdc.address, weight: 100 }],
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
      await mockPool.setTokens(core.tokens.grail.address, core.tokens.usdc.address);
      const tokenInfo = { ...GRAIL_TOKEN_INFO, pair: mockPool.address };
      await oracle.connect(core.governance).ownerSetTokenInfo(core.tokens.grail.address, tokenInfo);

      const info = await oracle.getTokenInfo(core.tokens.grail.address);
      expect(info.pair).to.eq(mockPool.address);
      expect(info.decimals).to.eq(GRAIL_TOKEN_INFO.decimals);
      expect(info.observationInterval).to.eq(GRAIL_TOKEN_INFO.observationInterval);
      expect(info.minPrice).to.eq(GRAIL_TOKEN_INFO.minPrice);
      expect(info.maxPrice).to.eq(GRAIL_TOKEN_INFO.maxPrice);
    });

    it('fails when the token is not in the pair', async () => {
      await mockPool.setTokens(core.tokens.weth.address, core.tokens.jones.address);
      const tokenInfo = { ...GRAIL_TOKEN_INFO, pair: mockPool.address };
      await expectThrow(
        oracle.connect(core.governance).ownerSetTokenInfo(core.tokens.grail.address, tokenInfo),
        'CamelotV3PriceOracleWithModifier: Invalid pair',
      );
    });

    it('fails when decimals are 0', async () => {
      await mockPool.setTokens(core.tokens.grail.address, core.tokens.usdc.address);
      const tokenInfo = { ...GRAIL_TOKEN_INFO, pair: mockPool.address, decimals: 0 };
      await expectThrow(
        oracle.connect(core.governance).ownerSetTokenInfo(core.tokens.grail.address, tokenInfo),
        'CamelotV3PriceOracleWithModifier: Invalid decimals',
      );
    });

    it('fails when decimals are greater than 18', async () => {
      await mockPool.setTokens(core.tokens.grail.address, core.tokens.usdc.address);
      const tokenInfo = { ...GRAIL_TOKEN_INFO, pair: mockPool.address, decimals: 19 };
      await expectThrow(
        oracle.connect(core.governance).ownerSetTokenInfo(core.tokens.grail.address, tokenInfo),
        'CamelotV3PriceOracleWithModifier: Invalid decimals',
      );
    });

    it('fails when min price is 0', async () => {
      await mockPool.setTokens(core.tokens.grail.address, core.tokens.usdc.address);
      const tokenInfo = { ...GRAIL_TOKEN_INFO, pair: mockPool.address, minPrice: 0 };
      await expectThrow(
        oracle.connect(core.governance).ownerSetTokenInfo(core.tokens.grail.address, tokenInfo),
        'CamelotV3PriceOracleWithModifier: Invalid min or max price',
      );
    });

    it('fails when max price is too large', async () => {
      await mockPool.setTokens(core.tokens.grail.address, core.tokens.usdc.address);
      const tokenInfo = { ...GRAIL_TOKEN_INFO, pair: mockPool.address, maxPrice: MAX_UINT_112_BI };
      await expectThrow(
        oracle.connect(core.governance).ownerSetTokenInfo(core.tokens.grail.address, tokenInfo),
        'CamelotV3PriceOracleWithModifier: Invalid min or max price',
      );
    });

    it('fails when min price is greater than max price', async () => {
      await mockPool.setTokens(core.tokens.grail.address, core.tokens.usdc.address);
      const tokenInfo = { ...GRAIL_TOKEN_INFO, pair: mockPool.address, minPrice: 100, maxPrice: 50 };
      await expectThrow(
        oracle.connect(core.governance).ownerSetTokenInfo(core.tokens.grail.address, tokenInfo),
        'CamelotV3PriceOracleWithModifier: Min and max price cross',
      );
    });

    it('fails when observation interval is too small', async () => {
      await mockPool.setTokens(core.tokens.grail.address, core.tokens.usdc.address);
      const tokenInfo = { ...GRAIL_TOKEN_INFO, pair: mockPool.address, observationInterval: 899 };
      await expectThrow(
        oracle.connect(core.governance).ownerSetTokenInfo(core.tokens.grail.address, tokenInfo),
        'CamelotV3PriceOracleWithModifier: Invalid observation interval',
      );
    });

    it('fails when invoked by non-admin', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).ownerSetTokenInfo(core.tokens.grail.address, GRAIL_TOKEN_INFO),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#getPrice', () => {
    it('should work normally when output token is token1', async () => {
      // DOLO is token0, USDC is token1
      await oracle.connect(core.governance).ownerSetTokenInfo(core.tokens.grail.address, GRAIL_TOKEN_INFO);
      const price = await core.oracleAggregatorV2.getPrice(core.tokens.grail.address);
      expect(price.value).to.eq(BigNumber.from('45162820736314500000'));
    });

    it('should fail if invalid token is passed', async () => {
      await expectThrow(
        oracle.getPrice(core.tokens.weth.address),
        `CamelotV3PriceOracleWithModifier: Invalid token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if price is too low', async () => {
      const tokenInfo = { ...GRAIL_TOKEN_INFO, minPrice: parseEther('50') };
      await oracle.connect(core.governance).ownerSetTokenInfo(core.tokens.grail.address, tokenInfo);

      await expectThrow(
        core.oracleAggregatorV2.getPrice(core.tokens.grail.address),
        'CamelotV3PriceOracleWithModifier: Price too low',
      );
    });

    it('should fail if price is too large', async () => {
      const tokenInfo = { ...GRAIL_TOKEN_INFO, maxPrice: parseEther('40') };
      await oracle.connect(core.governance).ownerSetTokenInfo(core.tokens.grail.address, tokenInfo);

      await expectThrow(
        core.oracleAggregatorV2.getPrice(core.tokens.grail.address),
        'CamelotV3PriceOracleWithModifier: Price too large',
      );
    });
  });
});
