import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { CoreProtocolEthereum } from 'packages/base/test/utils/core-protocols/core-protocol-ethereum';
import { TokenInfo } from '../src';
import { IWeEth, IWeEth__factory, EEthExchangeRatePriceOracle, EEthExchangeRatePriceOracle__factory } from '../src/types';
import { formatEther } from 'ethers/lib/utils';

describe('EEthExchangeRatePriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolEthereum;
  let oracle: EEthExchangeRatePriceOracle;
  let weEth: IWeEth;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.Ethereum,
      blockNumber: 26_127_000
    });

    weEth = IWeEth__factory.connect(core.tokens.weEth.address, core.hhUser1);
    oracle = await createContractWithAbi<EEthExchangeRatePriceOracle>(
      EEthExchangeRatePriceOracle__factory.abi,
      EEthExchangeRatePriceOracle__factory.bytecode,
      [weEth.address, core.dolomiteMargin.address],
    );

    const tokenInfo: TokenInfo = {
      oracleInfos: [{ oracle: oracle.address, tokenPair: core.tokens.weth.address, weight: 100 }],
      decimals: 18,
      token: core.tokens.weEth.address,
    };
    console.log('weETH price before: ', (await core.dolomiteMargin.getMarketPrice(core.marketIds.weEth)).value);
    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken(tokenInfo);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await oracle.WE_ETH()).to.eq(core.tokens.weEth.address);
      expect(await oracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });
  });

  describe('#getPrice', () => {
    it('should work normally calling the contract directly', async () => {
      const price = await oracle.getPrice(core.tokens.weEth.address);
      expect(price.value).to.eq(await weEth.getRate());
    });

    it('should work normally with oracle aggregator', async () => {
      const exchangeRate = await weEth.getRate();
      const wethPrice = (await core.dolomiteMargin.getMarketPrice(core.marketIds.weth)).value;
      const price = await core.oracleAggregatorV2.getPrice(core.tokens.weEth.address);
      expect(price.value).to.eq(exchangeRate.mul(wethPrice).div(ONE_ETH_BI));
      console.log('exchangeRate: ', formatEther(exchangeRate));
      console.log('wethPrice: ', formatEther(wethPrice));
      console.log('price: ', formatEther(price.value));
    });

    it('should fail if token is not weEth', async () => {
      await expectThrow(
        oracle.getPrice(core.tokens.weth.address),
        'EEthExchangeRatePriceOracle: Invalid token',
      );
    });
  });
});
