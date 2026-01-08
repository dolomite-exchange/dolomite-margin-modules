import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_DAY_SECONDS, ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  getRealLatestBlockNumber,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther, formatEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { CoreProtocolEthereum } from 'packages/base/test/utils/core-protocols/core-protocol-ethereum';
import { ST_ETH_MAP } from 'packages/base/src/utils/constants';
import { TokenInfo } from '../src';
import {
  CappedStEthExchangeRatePriceOracle,
  CappedStEthExchangeRatePriceOracle__factory,
  ILido,
  ILido__factory,
} from '../src/types';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';

const MINIMUM_SNAPSHOT_DELAY = 604800;
const SECONDS_PER_YEAR = 31536000;

const MAX_GROWTH_PER_YEAR = parseEther('.0968');
const SNAPSHOT_TIMESTAMP = 1766406214;
const SNAPSHOT_RATIO = BigNumber.from('1222491013327619390');
const NEW_SNAPSHOT_TIMESTAMP = 1767097826;
const NEW_SNAPSHOT_RATIO = BigNumber.from('1223172744594300520');

describe('CappedStEthExchangeRatePriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolEthereum;
  let oracle: CappedStEthExchangeRatePriceOracle;
  let lido: ILido;

  let maxGrowthPerSecond: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.Ethereum,
      blockNumber: await getRealLatestBlockNumber(true, Network.Ethereum),
    });

    lido = ILido__factory.connect(ST_ETH_MAP[Network.Ethereum].address, core.hhUser1);

    oracle = await createContractWithAbi<CappedStEthExchangeRatePriceOracle>(
      CappedStEthExchangeRatePriceOracle__factory.abi,
      CappedStEthExchangeRatePriceOracle__factory.bytecode,
      [
        lido.address,
        core.tokens.wstEth.address,
        {
          snapshotRatio: SNAPSHOT_RATIO,
          snapshotTimestamp: SNAPSHOT_TIMESTAMP,
          maxGrowthPerYear: MAX_GROWTH_PER_YEAR,
        },
        core.dolomiteMargin.address,
      ],
    );

    const tokenInfo: TokenInfo = {
      oracleInfos: [{ oracle: oracle.address, tokenPair: core.tokens.weth.address, weight: 100 }],
      decimals: 18,
      token: core.tokens.wstEth.address,
    };
    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken(tokenInfo);

    maxGrowthPerSecond = SNAPSHOT_RATIO.mul(MAX_GROWTH_PER_YEAR).div(ONE_ETH_BI).div(SECONDS_PER_YEAR);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await oracle.LIDO()).to.eq(lido.address);
      expect(await oracle.WST_ETH()).to.eq(core.tokens.wstEth.address);
      expect(await oracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await oracle.snapshotRatio()).to.eq(SNAPSHOT_RATIO);
      expect(await oracle.snapshotTimestamp()).to.eq(SNAPSHOT_TIMESTAMP);
      expect(await oracle.maxGrowthPerSecond()).to.eq(maxGrowthPerSecond);
    });
  });

  describe('#ownerSetCapParameters', () => {
    it('should work normally', async () => {
      const newGrowthPerSecond = NEW_SNAPSHOT_RATIO.mul(MAX_GROWTH_PER_YEAR).div(ONE_ETH_BI).div(SECONDS_PER_YEAR);

      const res = await oracle.connect(core.governance).ownerSetCapParameters({
        snapshotRatio: NEW_SNAPSHOT_RATIO,
        snapshotTimestamp: NEW_SNAPSHOT_TIMESTAMP,
        maxGrowthPerYear: MAX_GROWTH_PER_YEAR,
      });

      await expectEvent(oracle, res, 'CapParametersSet', {
        snapshotRatio: NEW_SNAPSHOT_RATIO,
        snapshotTimestamp: NEW_SNAPSHOT_TIMESTAMP,
        maxGrowthPerSecond: newGrowthPerSecond,
      });

      expect(await oracle.snapshotRatio()).to.eq(NEW_SNAPSHOT_RATIO);
      expect(await oracle.snapshotTimestamp()).to.eq(NEW_SNAPSHOT_TIMESTAMP);
      expect(await oracle.maxGrowthPerSecond()).to.eq(newGrowthPerSecond);
    });

    it('should fail if snapshot ratio is 0', async () => {
      await expectThrow(
        oracle.connect(core.governance).ownerSetCapParameters({
          snapshotRatio: 0,
          snapshotTimestamp: NEW_SNAPSHOT_TIMESTAMP,
          maxGrowthPerYear: MAX_GROWTH_PER_YEAR,
        }),
        'CappedStEthExchangeRateOracle: Snapshot ratio cannot be 0',
      );
    });

    it('should fail if snapshot timestamp is too recent', async () => {
      const latestBlockTimestamp = await ethers.provider.getBlock('latest').then(block => block.timestamp);

      await increase(ONE_DAY_SECONDS * 7 - 1);
      await expectThrow(
        oracle.connect(core.governance).ownerSetCapParameters({
          snapshotRatio: NEW_SNAPSHOT_RATIO,
          snapshotTimestamp: latestBlockTimestamp,
          maxGrowthPerYear: MAX_GROWTH_PER_YEAR,
        }),
        'CappedStEthExchangeRateOracle: Invalid snapshot timestamp',
      );
      await oracle.connect(core.governance).ownerSetCapParameters({
        snapshotRatio: NEW_SNAPSHOT_RATIO,
        snapshotTimestamp: latestBlockTimestamp,
        maxGrowthPerYear: MAX_GROWTH_PER_YEAR,
      });
    });

    it('should fail if snapshot timestamp older than current snapshot timestamp', async () => {
      await expectThrow(
        oracle.connect(core.governance).ownerSetCapParameters({
          snapshotRatio: NEW_SNAPSHOT_RATIO,
          snapshotTimestamp: SNAPSHOT_TIMESTAMP - 1,
          maxGrowthPerYear: MAX_GROWTH_PER_YEAR,
        }),
        'CappedStEthExchangeRateOracle: Invalid snapshot timestamp',
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).ownerSetCapParameters({
          snapshotRatio: NEW_SNAPSHOT_RATIO,
          snapshotTimestamp: NEW_SNAPSHOT_TIMESTAMP,
          maxGrowthPerYear: MAX_GROWTH_PER_YEAR,
        }),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#getPrice', () => {
    it('should return the current rate when under the cap', async () => {
      const currentRate = await lido.getPooledEthByShares(ONE_ETH_BI);
      const price = await oracle.getPrice(core.tokens.wstEth.address);
      expect(price.value).to.eq(currentRate);
    });

    it('should work normally with oracle aggregator when under the cap', async () => {
      const exchangeRate = await lido.getPooledEthByShares(ONE_ETH_BI);
      const wethPrice = (await core.dolomiteMargin.getMarketPrice(core.marketIds.weth)).value;
      const price = await core.oracleAggregatorV2.getPrice(core.tokens.wstEth.address);
      expect(price.value).to.eq(exchangeRate.mul(wethPrice).div(ONE_ETH_BI));
      console.log('exchangeRate: ', formatEther(exchangeRate));
      console.log('wethPrice: ', formatEther(wethPrice));
      console.log('price: ', formatEther(price.value));
    });

    it('should return the capped rate when the current rate exceeds the cap', async () => {
      const cappedOracle = await createContractWithAbi<CappedStEthExchangeRatePriceOracle>(
        CappedStEthExchangeRatePriceOracle__factory.abi,
        CappedStEthExchangeRatePriceOracle__factory.bytecode,
        [
          lido.address,
          core.tokens.wstEth.address,
          {
            snapshotRatio: NEW_SNAPSHOT_RATIO,
            snapshotTimestamp: NEW_SNAPSHOT_TIMESTAMP,
            maxGrowthPerYear: 0,
          },
          core.dolomiteMargin.address,
        ],
      );

      const price = await cappedOracle.getPrice(core.tokens.wstEth.address);
      expect(price.value).to.eq(NEW_SNAPSHOT_RATIO);
    });

    it('should fail if token is not wstEth', async () => {
      await expectThrow(
        oracle.getPrice(core.tokens.weth.address),
        'CappedStEthExchangeRateOracle: Invalid token',
      );
    });
  });
});
