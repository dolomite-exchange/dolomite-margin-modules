import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { CoreProtocolEthereum } from 'packages/base/test/utils/core-protocols/core-protocol-ethereum';
import { ST_ETH_MAP } from 'packages/base/src/utils/constants';
import { TokenInfo } from '../src';
import { ILido, ILido__factory, StEthExchangeRatePriceOracle, StEthExchangeRatePriceOracle__factory } from '../src/types';
import { formatEther } from 'ethers/lib/utils';

describe('StEthExchangeRatePriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolEthereum;
  let oracle: StEthExchangeRatePriceOracle;
  let lido: ILido;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.Ethereum,
      blockNumber: await getRealLatestBlockNumber(true, Network.Ethereum),
    });

    lido = ILido__factory.connect(ST_ETH_MAP[Network.Ethereum].address, core.hhUser1);
    oracle = await createContractWithAbi<StEthExchangeRatePriceOracle>(
      StEthExchangeRatePriceOracle__factory.abi,
      StEthExchangeRatePriceOracle__factory.bytecode,
      [lido.address, core.tokens.wstEth.address, core.dolomiteMargin.address],
    );

    const tokenInfo: TokenInfo = {
      oracleInfos: [{ oracle: oracle.address, tokenPair: core.tokens.weth.address, weight: 100 }],
      decimals: 18,
      token: core.tokens.wstEth.address,
    };
    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken(tokenInfo);

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
    });
  });

  describe('#getPrice', () => {
    it('should work normally calling the contract directly', async () => {
      const price = await oracle.getPrice(core.tokens.wstEth.address);
      expect(price.value).to.eq(await lido.getPooledEthByShares(ONE_ETH_BI));
    });

    it('should work normally with oracle aggregator', async () => {
      const exchangeRate = await lido.getPooledEthByShares(ONE_ETH_BI);
      const wethPrice = (await core.dolomiteMargin.getMarketPrice(core.marketIds.weth)).value;
      const price = await core.oracleAggregatorV2.getPrice(core.tokens.wstEth.address);
      expect(price.value).to.eq(exchangeRate.mul(wethPrice).div(ONE_ETH_BI));
      console.log('exchangeRate: ', formatEther(exchangeRate));
      console.log('wethPrice: ', formatEther(wethPrice));
      console.log('price: ', formatEther(price.value));
    });

    it('should fail if token is not wstEth', async () => {
      await expectThrow(
        oracle.getPrice(core.tokens.weth.address),
        'StEthExchangeRatePriceOracle: Invalid token',
      );
    });
  });
});
