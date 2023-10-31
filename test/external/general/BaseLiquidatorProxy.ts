import { INTEGERS } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { TestBaseLiquidatorProxy, TestBaseLiquidatorProxy__factory } from '../../../src/types';
import {
  createContractWithAbi,
  depositIntoDolomiteMargin,
  getPartialRoundUp,
  withdrawFromDolomiteMargin,
} from '../../../src/utils/dolomite-utils';
import { MAX_UINT_256_BI, Network, ONE_ETH_BI, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { getBlockTimestamp, impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectThrow } from '../../utils/assertions';
import { setExpiry } from '../../utils/expiry-utils';
import {
  CoreProtocol,
  disableInterestAccrual,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupWETHBalance,
} from '../../utils/setup';

const solidAccount = {
  owner: '0x52256ef863a713ef349ae6e97a7e8f35785145de',
  number: '0',
};
const liquidAccount = {
  owner: '0xc93b2a614453ad041f0143dcb9b05448505def01',
  number: '92127868775155223522677465536015646923360873953133361407154510917254498286069',
};

describe('BaseLiquidatorProxy', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let proxy: TestBaseLiquidatorProxy;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    proxy = await createContractWithAbi<TestBaseLiquidatorProxy>(
      TestBaseLiquidatorProxy__factory.abi,
      TestBaseLiquidatorProxy__factory.bytecode,
      [core.dolomiteMargin.address, core.expiry.address, core.liquidatorAssetRegistry.address],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('initializeCache', () => {
    it('should work when expiration timestamp is 0', async () => {
      const solidMarkets = await core.dolomiteMargin.getAccountMarketsWithBalances(solidAccount);
      const liquidMarkets = await core.dolomiteMargin.getAccountMarketsWithBalances(liquidAccount);
      const heldMarket = core.marketIds.dfsGlp!;
      const owedMarket = core.marketIds.wbtc;
      const owedPrice = (await core.dolomiteMargin.getMarketPrice(owedMarket)).value;
      const cache = await proxy.initializeCache({
        solidAccount,
        liquidAccount,
        liquidMarkets,
        heldMarket,
        owedMarket,
        markets: await proxy.getMarketInfos(solidMarkets, liquidMarkets),
        expirationTimestamp: 0,
      });
      expect(cache.owedWeiToLiquidate).to.eq(0);
      expect(cache.solidHeldUpdateWithReward).to.eq(0);
      expect(cache.solidHeldWei.sign).to.eq(false); // value is 0, therefore sign is false
      expect(cache.solidHeldWei.value).to.eq((await core.dolomiteMargin.getAccountWei(solidAccount, heldMarket)).value);
      expect(cache.solidOwedWei.sign).to.eq(true);
      expect(cache.solidOwedWei.value).to.eq((await core.dolomiteMargin.getAccountWei(solidAccount, owedMarket)).value);
      expect(cache.liquidHeldWei.sign).to.eq(true);
      expect(cache.liquidHeldWei.value)
        .to
        .eq((await core.dolomiteMargin.getAccountWei(liquidAccount, heldMarket)).value);
      expect(cache.liquidOwedWei.sign).to.eq(false);
      expect(cache.liquidOwedWei.value)
        .to
        .eq((await core.dolomiteMargin.getAccountWei(liquidAccount, owedMarket)).value);
      expect(cache.flipMarketsForExpiration).to.eq(false);
      expect(cache.heldPrice).to.eq((await core.dolomiteMargin.getMarketPrice(heldMarket)).value);
      expect(cache.owedPrice).to.eq(owedPrice);
      expect(cache.owedPriceAdj).to.eq(owedPrice.mul(107).div(100));
    });

    it('should work when expiration timestamp is not 0', async () => {
      const solidMarkets = await core.dolomiteMargin.getAccountMarketsWithBalances(solidAccount);
      const liquidMarkets = await core.dolomiteMargin.getAccountMarketsWithBalances(liquidAccount);
      const heldMarket = core.marketIds.dfsGlp!;
      const owedMarket = core.marketIds.wbtc;
      const owedPrice = (await core.dolomiteMargin.getMarketPrice(owedMarket)).value;
      const constants = {
        solidAccount,
        liquidAccount,
        liquidMarkets,
        heldMarket,
        owedMarket,
        markets: await proxy.getMarketInfos(solidMarkets, liquidMarkets),
        expirationTimestamp: await getBlockTimestamp(core.config.blockNumber) - 300, // 5 minutes ramp time
      };
      const cache = await proxy.initializeCache(constants);
      expect(cache.owedWeiToLiquidate).to.eq(0);
      expect(cache.solidHeldUpdateWithReward).to.eq(0);
      expect(cache.solidHeldWei.sign).to.eq(false); // value is 0, therefore sign is false
      expect(cache.solidHeldWei.value).to.eq((await core.dolomiteMargin.getAccountWei(solidAccount, heldMarket)).value);
      expect(cache.solidOwedWei.sign).to.eq(true);
      expect(cache.solidOwedWei.value).to.eq((await core.dolomiteMargin.getAccountWei(solidAccount, owedMarket)).value);
      expect(cache.liquidHeldWei.sign).to.eq(true);
      expect(cache.liquidHeldWei.value)
        .to
        .eq((await core.dolomiteMargin.getAccountWei(liquidAccount, heldMarket)).value);
      expect(cache.liquidOwedWei.sign).to.eq(false);
      expect(cache.liquidOwedWei.value)
        .to
        .eq((await core.dolomiteMargin.getAccountWei(liquidAccount, owedMarket)).value);
      expect(cache.flipMarketsForExpiration).to.eq(false);
      expect(cache.heldPrice).to.eq((await core.dolomiteMargin.getMarketPrice(heldMarket)).value);
      expect(cache.owedPrice).to.eq(owedPrice);
      expect(cache.owedPriceAdj).to.eq(owedPrice.mul(10700).div(10000));
    });
  });

  describe('checkConstants', () => {
    it('should work', async () => {
      const solidMarkets = await core.dolomiteMargin.getAccountMarketsWithBalances(solidAccount);
      const liquidMarkets = await core.dolomiteMargin.getAccountMarketsWithBalances(liquidAccount);
      const heldMarket = core.marketIds.dfsGlp!;
      const owedMarket = core.marketIds.wbtc;
      const constants = {
        solidAccount,
        liquidAccount,
        liquidMarkets,
        heldMarket,
        owedMarket,
        markets: await proxy.getMarketInfos(solidMarkets, liquidMarkets),
        expirationTimestamp: 0,
      };
      await proxy.checkConstants(constants);
    });

    it('should fail when the markets are the same', async () => {
      const solidMarkets = await core.dolomiteMargin.getAccountMarketsWithBalances(solidAccount);
      const liquidMarkets = await core.dolomiteMargin.getAccountMarketsWithBalances(liquidAccount);
      const heldMarket = core.marketIds.dfsGlp!;
      const owedMarket = heldMarket;
      const constants = {
        solidAccount,
        liquidAccount,
        liquidMarkets,
        heldMarket,
        owedMarket,
        markets: await proxy.getMarketInfos(solidMarkets, liquidMarkets),
        expirationTimestamp: 0,
      };
      await expectThrow(
        proxy.checkConstants(constants),
        `BaseLiquidatorProxy: Owed market equals held market <${heldMarket.toString()}>`,
      );
    });

    it('should fail when the owed market is positive', async () => {
      const solidMarkets = await core.dolomiteMargin.getAccountMarketsWithBalances(solidAccount);
      const liquidMarkets = await core.dolomiteMargin.getAccountMarketsWithBalances(liquidAccount);
      const heldMarket = core.marketIds.wbtc;
      const owedMarket = core.marketIds.dfsGlp!;
      const constants = {
        solidAccount,
        liquidAccount,
        liquidMarkets,
        heldMarket,
        owedMarket,
        markets: await proxy.getMarketInfos(solidMarkets, liquidMarkets),
        expirationTimestamp: 0,
      };
      await expectThrow(
        proxy.checkConstants(constants),
        `BaseLiquidatorProxy: Owed market cannot be positive <${owedMarket.toString()}>`,
      );
    });

    it('should fail when the held market is negative', async () => {
      const solidMarkets = await core.dolomiteMargin.getAccountMarketsWithBalances(solidAccount);
      const liquidMarkets = await core.dolomiteMargin.getAccountMarketsWithBalances(liquidAccount);
      const heldMarket = core.marketIds.wbtc;
      const owedMarket = core.marketIds.weth;
      const constants = {
        solidAccount,
        liquidAccount,
        liquidMarkets,
        heldMarket,
        owedMarket,
        markets: await proxy.getMarketInfos(solidMarkets, liquidMarkets),
        expirationTimestamp: 0,
      };
      await expectThrow(
        proxy.checkConstants(constants),
        `BaseLiquidatorProxy: Held market cannot be negative <${heldMarket.toString()}>`,
      );
    });

    it('should fail when expiration timestamp overflows', async () => {
      const solidMarkets = await core.dolomiteMargin.getAccountMarketsWithBalances(solidAccount);
      const liquidMarkets = await core.dolomiteMargin.getAccountMarketsWithBalances(liquidAccount);
      const heldMarket = core.marketIds.dfsGlp!;
      const owedMarket = core.marketIds.weth;
      const constants = {
        solidAccount,
        liquidAccount,
        liquidMarkets,
        heldMarket,
        owedMarket,
        markets: await proxy.getMarketInfos(solidMarkets, liquidMarkets),
        expirationTimestamp: INTEGERS.MAX_UINT.toFixed(),
      };
      await expectThrow(
        proxy.checkConstants(constants),
        `BaseLiquidatorProxy: Expiration timestamp overflows <${constants.expirationTimestamp}>`,
      );
    });

    it('should fail when expiration timestamp has not passed yet', async () => {
      const solidMarkets = await core.dolomiteMargin.getAccountMarketsWithBalances(solidAccount);
      const liquidMarkets = await core.dolomiteMargin.getAccountMarketsWithBalances(liquidAccount);
      const heldMarket = core.marketIds.dfsGlp!;
      const owedMarket = core.marketIds.weth;
      const constants = {
        solidAccount,
        liquidAccount,
        liquidMarkets,
        heldMarket,
        owedMarket,
        markets: await proxy.getMarketInfos(solidMarkets, liquidMarkets),
        expirationTimestamp: await getBlockTimestamp(core.config.blockNumber) + 100,
      };
      await expectThrow(
        proxy.checkConstants(constants),
        `BaseLiquidatorProxy: Borrow not yet expired <${constants.expirationTimestamp}>`,
      );
    });
  });

  describe('checkBasicRequirements', () => {
    it('should work when sender is solid account', async () => {
      const solidMarkets = await core.dolomiteMargin.getAccountMarketsWithBalances(solidAccount);
      const liquidMarkets = await core.dolomiteMargin.getAccountMarketsWithBalances(liquidAccount);
      const heldMarket = core.marketIds.dfsGlp!;
      const owedMarket = core.marketIds.weth;
      const constants = {
        solidAccount,
        liquidAccount,
        liquidMarkets,
        heldMarket,
        owedMarket,
        markets: await proxy.getMarketInfos(solidMarkets, liquidMarkets),
        expirationTimestamp: 0,
      };
      const sender = await impersonate(solidAccount.owner, true);
      await proxy.connect(sender).checkBasicRequirements(constants);
    });

    it('should work when sender is an approved operator of solid account', async () => {
      const solidMarkets = await core.dolomiteMargin.getAccountMarketsWithBalances(solidAccount);
      const liquidMarkets = await core.dolomiteMargin.getAccountMarketsWithBalances(liquidAccount);
      const heldMarket = core.marketIds.dfsGlp!;
      const owedMarket = core.marketIds.weth;
      const constants = {
        solidAccount,
        liquidAccount,
        liquidMarkets,
        heldMarket,
        owedMarket,
        markets: await proxy.getMarketInfos(solidMarkets, liquidMarkets),
        expirationTimestamp: 0,
      };
      const signer = await impersonate(solidAccount.owner, true);
      const sender = core.hhUser1;
      await core.dolomiteMargin.connect(signer).setOperators([{ operator: sender.address, trusted: true }]);
      await proxy.connect(sender).checkBasicRequirements(constants);
    });

    it('should work when an expiration is sent and it matches', async () => {
      const solidMarkets = await core.dolomiteMargin.getAccountMarketsWithBalances(solidAccount);
      const liquidMarkets = await core.dolomiteMargin.getAccountMarketsWithBalances(liquidAccount);
      const heldMarket = core.marketIds.dfsGlp!;
      const owedMarket = core.marketIds.weth;
      const constants = {
        solidAccount,
        liquidAccount,
        liquidMarkets,
        heldMarket,
        owedMarket,
        markets: await proxy.getMarketInfos(solidMarkets, liquidMarkets),
        expirationTimestamp: 0,
      };
      await setExpiry(core, liquidAccount, owedMarket, 123);
      constants.expirationTimestamp = await core.expiry.getExpiry(liquidAccount, owedMarket);

      const signer = await impersonate(solidAccount.owner, true);
      const sender = core.hhUser1;
      await core.dolomiteMargin.connect(signer).setOperators([{ operator: sender.address, trusted: true }]);
      await proxy.connect(sender).checkBasicRequirements(constants);
    });

    it('should fail when sender is not an approved operator of solid account', async () => {
      const solidMarkets = await core.dolomiteMargin.getAccountMarketsWithBalances(solidAccount);
      const liquidMarkets = await core.dolomiteMargin.getAccountMarketsWithBalances(liquidAccount);
      const heldMarket = core.marketIds.dfsGlp!;
      const owedMarket = core.marketIds.weth;
      const constants = {
        solidAccount,
        liquidAccount,
        liquidMarkets,
        heldMarket,
        owedMarket,
        markets: await proxy.getMarketInfos(solidMarkets, liquidMarkets),
        expirationTimestamp: 0,
      };
      const sender = core.hhUser1;
      await core.dolomiteMargin.setOperators([{ operator: sender.address, trusted: false }]);
      await expectThrow(
        proxy.connect(sender).checkBasicRequirements(constants),
        `BaseLiquidatorProxy: Sender not operator <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when the expiration timestamp does not match', async () => {
      const solidMarkets = await core.dolomiteMargin.getAccountMarketsWithBalances(solidAccount);
      const liquidMarkets = await core.dolomiteMargin.getAccountMarketsWithBalances(liquidAccount);
      const heldMarket = core.marketIds.dfsGlp!;
      const owedMarket = core.marketIds.weth;
      const constants = {
        solidAccount,
        liquidAccount,
        liquidMarkets,
        heldMarket,
        owedMarket,
        markets: await proxy.getMarketInfos(solidMarkets, liquidMarkets),
        expirationTimestamp: await getBlockTimestamp(core.config.blockNumber) - 100,
      };
      const sender = await impersonate(solidAccount.owner);
      await expectThrow(
        proxy.connect(sender).checkBasicRequirements(constants),
        `BaseLiquidatorProxy: Expiration timestamp mismatch <0, ${constants.expirationTimestamp}>`,
      );
    });
  });

  describe('getAccountValues', () => {
    it('should work', async () => {
      await disableInterestAccrual(core, core.marketIds.weth);
      await disableInterestAccrual(core, core.marketIds.wbtc);
      const account = { owner: core.hhUser1.address, number: 0 };
      const ethAmount = ONE_ETH_BI;
      const wbtcAmount = BigNumber.from('1000000');
      const ethPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.weth);
      const wbtcPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.wbtc);
      await setupWETHBalance(core, core.hhUser1, ONE_ETH_BI, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, 0, core.marketIds.weth, ethAmount);
      await withdrawFromDolomiteMargin(core, core.hhUser1, 0, core.marketIds.wbtc, wbtcAmount);
      const marketIds = [core.marketIds.weth, core.marketIds.wbtc];
      const marketInfos = await proxy.getMarketInfos(marketIds, []);
      const [supply, borrow] = await proxy.getAccountValues(marketInfos, account, marketIds);
      expect(supply.value).to.eq(ethAmount.mul(ethPrice.value));
      expect(borrow.value).to.eq(wbtcAmount.mul(wbtcPrice.value));
    });
  });

  describe('getAdjustedAccountValues', () => {
    it('should work', async () => {
      await disableInterestAccrual(core, core.marketIds.weth);
      await disableInterestAccrual(core, core.marketIds.wbtc);
      const account = { owner: core.hhUser1.address, number: 0 };
      const ethAmount = ONE_ETH_BI;
      const wbtcAmount = BigNumber.from('1000000');
      const ethPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.weth);
      const wbtcPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.wbtc);
      await setupWETHBalance(core, core.hhUser1, ONE_ETH_BI, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, 0, core.marketIds.weth, ethAmount);
      await withdrawFromDolomiteMargin(core, core.hhUser1, 0, core.marketIds.wbtc, wbtcAmount);
      const marketIds = [core.marketIds.weth, core.marketIds.wbtc];
      const marketInfos = await proxy.getMarketInfos(marketIds, []);
      const [supply, borrow] = await proxy.getAdjustedAccountValues(marketInfos, account, marketIds);
      expect(supply.value).to.eq(ethAmount.mul(ethPrice.value));
      expect(borrow.value).to.eq(wbtcAmount.mul(wbtcPrice.value).mul('1086956521739130434').div(ONE_ETH_BI));
    });
  });

  describe('getMarketInfos', () => {
    it('should work normally', async () => {
      const marketInfos = await proxy.getMarketInfos([2, 1, 0], [3, 6, 5]);
      expect(marketInfos.length).to.eq(6);
      expect(marketInfos.map(m => m.marketId.toNumber())).to.eql([0, 1, 2, 3, 5, 6]);
      for (let i = 0; i < marketInfos.length; i++) {
        const price = await core.dolomiteMargin.getMarketPrice(marketInfos[i].marketId);
        const index = await core.dolomiteMargin.getMarketCurrentIndex(marketInfos[i].marketId);
        expect(marketInfos[i].price.value).to.eq(price.value);
        expect(marketInfos[i].index.supply).to.eq(index.supply);
        expect(marketInfos[i].index.borrow).to.eq(index.borrow);
        expect(marketInfos[i].index.lastUpdate).to.eq(index.lastUpdate);
      }
    });

    it('should fail when a market is not found', async () => {
      const marketInfos = await proxy.getMarketInfos([0, 1, 2], []);
      await expectThrow(
        proxy.getAdjustedAccountValues(marketInfos, solidAccount, [0, 1, 2, 10]),
        'BaseLiquidatorProxy: Market not found',
      );
      await expectThrow(
        proxy.getAdjustedAccountValues([], solidAccount, [0, 1, 2, 10]),
        'BaseLiquidatorProxy: Market not found',
      );
    });
  });

  describe('calculateAndSetMaxLiquidationAmount', () => {
    it('should work when held value >= owed value (adj)', async () => {
      const solidHeldWei = ZERO_BI;
      const solidOwedWei = ZERO_BI;
      const liquidHeldWei = BigNumber.from('1000000000000000000');
      const liquidOwedWei = BigNumber.from('850000000000000000');
      const heldPrice = BigNumber.from('1830000000000000000000');
      const owedPrice = BigNumber.from('1925000000000000000000');
      const owedPriceAdj = owedPrice.mul(105).div(100);
      const cache = {
        heldPrice,
        owedPrice,
        owedPriceAdj,
        owedWeiToLiquidate: ZERO_BI,
        solidHeldUpdateWithReward: ZERO_BI,
        solidHeldWei: { sign: false, value: solidHeldWei },
        solidOwedWei: { sign: false, value: solidOwedWei },
        liquidHeldWei: { sign: true, value: liquidHeldWei },
        liquidOwedWei: { sign: false, value: liquidOwedWei },
        flipMarketsForExpiration: false,
      };
      expect(cache.solidHeldUpdateWithReward).to.eq(0);
      expect(cache.owedWeiToLiquidate).to.eq(0);
      expect(cache.flipMarketsForExpiration).to.eq(false);

      const newCache = await proxy.calculateAndSetMaxLiquidationAmount(cache);
      expect(newCache.solidHeldUpdateWithReward).eq(liquidOwedWei.mul(owedPriceAdj).div(heldPrice));
      expect(newCache.owedWeiToLiquidate).eq(liquidOwedWei);
      expect(newCache.flipMarketsForExpiration).eq(false);
    });

    it('should work when held value < owed value (adj)', async () => {
      const solidHeldWei = ZERO_BI;
      const solidOwedWei = ZERO_BI;
      const liquidHeldWei = BigNumber.from('1000000000000000000');
      const liquidOwedWei = BigNumber.from('930000000000000000');
      const heldPrice = BigNumber.from('1830000000000000000000');
      const owedPrice = BigNumber.from('1925000000000000000000');
      const owedPriceAdj = owedPrice.mul(105).div(100);
      const cache = {
        heldPrice,
        owedPrice,
        owedPriceAdj,
        owedWeiToLiquidate: ZERO_BI,
        solidHeldUpdateWithReward: ZERO_BI,
        solidHeldWei: { sign: false, value: solidHeldWei },
        solidOwedWei: { sign: false, value: solidOwedWei },
        liquidHeldWei: { sign: true, value: liquidHeldWei },
        liquidOwedWei: { sign: false, value: liquidOwedWei },
        flipMarketsForExpiration: false,
      };
      expect(cache.solidHeldUpdateWithReward).to.eq(0);
      expect(cache.owedWeiToLiquidate).to.eq(0);
      expect(cache.flipMarketsForExpiration).to.eq(false);

      const newCache = await proxy.calculateAndSetMaxLiquidationAmount(cache);
      expect(newCache.solidHeldUpdateWithReward).eq(liquidHeldWei);
      expect(newCache.owedWeiToLiquidate).eq(getPartialRoundUp(liquidHeldWei, heldPrice, owedPriceAdj));
      expect(newCache.flipMarketsForExpiration).eq(true);
    });
  });

  describe('calculateAndSetActualLiquidationAmount', () => {
    it('should work when set to liquidate all for all debt', async () => {
      const solidHeldWei = ZERO_BI;
      const solidOwedWei = ZERO_BI;
      const liquidHeldWei = BigNumber.from('1000000000000000000');
      const liquidOwedWei = BigNumber.from('850000000000000000');
      const heldPrice = BigNumber.from('1830000000000000000000');
      const owedPrice = BigNumber.from('1925000000000000000000');
      const owedPriceAdj = owedPrice.mul(105).div(100);
      const cache = {
        heldPrice,
        owedPrice,
        owedPriceAdj,
        owedWeiToLiquidate: ZERO_BI,
        solidHeldUpdateWithReward: ZERO_BI,
        solidHeldWei: { sign: false, value: solidHeldWei },
        solidOwedWei: { sign: false, value: solidOwedWei },
        liquidHeldWei: { sign: true, value: liquidHeldWei },
        liquidOwedWei: { sign: false, value: liquidOwedWei },
        flipMarketsForExpiration: false,
      };
      const newCache = await proxy.calculateAndSetMaxLiquidationAmount(cache);
      const result = await proxy.calculateAndSetActualLiquidationAmount(
        MAX_UINT_256_BI,
        MAX_UINT_256_BI,
        newCache,
      );
      expect(result.newInputAmountWei).eq(newCache.solidHeldUpdateWithReward);
      expect(result.newMinOutputAmountWei).eq(newCache.owedWeiToLiquidate);
      expect(result.newCache.owedWeiToLiquidate).eq(newCache.owedWeiToLiquidate);
      expect(result.newCache.solidHeldUpdateWithReward).eq(newCache.solidHeldUpdateWithReward);
    });

    it('should work when set to liquidate specific held for specific debt', async () => {
      const solidHeldWei = ZERO_BI;
      const solidOwedWei = ZERO_BI;
      const liquidHeldWei = BigNumber.from('1000000000000000000');
      const liquidOwedWei = BigNumber.from('850000000000000000');
      const heldPrice = BigNumber.from('1830000000000000000000');
      const owedPrice = BigNumber.from('1925000000000000000000');
      const owedPriceAdj = owedPrice.mul(105).div(100);
      const cache = {
        heldPrice,
        owedPrice,
        owedPriceAdj,
        owedWeiToLiquidate: ZERO_BI,
        solidHeldUpdateWithReward: ZERO_BI,
        solidHeldWei: { sign: false, value: solidHeldWei },
        solidOwedWei: { sign: false, value: solidOwedWei },
        liquidHeldWei: { sign: true, value: liquidHeldWei },
        liquidOwedWei: { sign: false, value: liquidOwedWei },
        flipMarketsForExpiration: false,
      };
      const newCache = await proxy.calculateAndSetMaxLiquidationAmount(cache);
      const owedWeiToLiquidate = newCache.owedWeiToLiquidate.mul(9).div(10);
      const result = await proxy.calculateAndSetActualLiquidationAmount(
        newCache.solidHeldUpdateWithReward,
        owedWeiToLiquidate,
        newCache,
      );
      expect(result.newMinOutputAmountWei).eq(owedWeiToLiquidate);
      expect(result.newInputAmountWei).eq(newCache.solidHeldUpdateWithReward);
      expect(result.newCache.owedWeiToLiquidate).eq(owedWeiToLiquidate);
      expect(result.newCache.solidHeldUpdateWithReward).eq(owedWeiToLiquidate.mul(owedPriceAdj).div(heldPrice));
    });
  });

  describe('isCollateralized', () => {
    it('should work', async () => {
      expect(await proxy.isCollateralized(115, 100, { value: '150000000000000000' })).to.eq(true);
      expect(await proxy.isCollateralized(116, 100, { value: '150000000000000000' })).to.eq(true);
      expect(await proxy.isCollateralized(114, 100, { value: '150000000000000000' })).to.eq(false);
      expect(await proxy.isCollateralized(90, 100, { value: '150000000000000000' })).to.eq(false);
    });
  });
});
