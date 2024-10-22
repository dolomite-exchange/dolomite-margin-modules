import { ADDRESS_ZERO, Network, ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  getRealLatestBlockNumber,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol, setupTestMarket } from '@dolomite-exchange/modules-base/test/utils/setup';
import axios from 'axios';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { PendlePtIsolationModeVaultFactory, PendlePtPriceOracleV2, PendleRegistry } from '../../src/types';
import {
  createPendlePtIsolationModeTokenVaultV1,
  createPendlePtIsolationModeVaultFactory,
  createPendlePtPriceOracleV2,
  createPendleRegistry,
} from '../pendle-ecosystem-utils';

describe('PendlePtRsEthDec2024PriceOracleV2_integration', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let ptOracle: PendlePtPriceOracleV2;
  let pendleRegistry: PendleRegistry;
  let factory: PendlePtIsolationModeVaultFactory;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: await getRealLatestBlockNumber(true, Network.ArbitrumOne),
      network: Network.ArbitrumOne,
    });

    const userVaultImplementation = await createPendlePtIsolationModeTokenVaultV1();
    pendleRegistry = await createPendleRegistry(
      core,
      core.pendleEcosystem!.rsEthDec2024.rsEthMarket,
      core.pendleEcosystem!.rsEthDec2024.ptOracle,
      core.pendleEcosystem!.syRsEthToken,
    );
    factory = await createPendlePtIsolationModeVaultFactory(
      core,
      pendleRegistry,
      core.pendleEcosystem!.rsEthDec2024.ptRsEthToken,
      userVaultImplementation,
    );
    ptOracle = await createPendlePtPriceOracleV2(core, factory, pendleRegistry);
    const tokenInfo = {
      oracleInfos: [
        { oracle: ptOracle.address, tokenPair: core.tokens.weth.address, weight: 100 }
      ],
      decimals: 18,
      token: factory.address
    };
    await core.oracleAggregatorV2.ownerInsertOrUpdateToken(tokenInfo);
    await setupTestMarket(core, factory, true, core.oracleAggregatorV2);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.connect(core.governance).ownerInitialize([]);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('constructor', () => {
    it('should work normally', async () => {
      expect(await ptOracle.DPT_TOKEN()).to.eq(factory.address);
      expect(await ptOracle.REGISTRY()).to.eq(pendleRegistry.address);
      expect(await ptOracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value under normal conditions for the dptToken', async () => {
      const BASE_URL = 'https://api-v2.pendle.finance/sdk/api/v1';
      const data = await axios.get(`${BASE_URL}/swapExactPtForToken`, {
        params: {
          chainId: Network.ArbitrumOne.toString(),
          receiverAddr: core.hhUser1.address.toLowerCase(),
          marketAddr: core.pendleEcosystem.rsEthDec2024.rsEthMarket.address,
          amountPtIn: ONE_ETH_BI.toString(),
          tokenOutAddr: ADDRESS_ZERO,
          syTokenOutAddr: core.tokens.rsEth.address,
          slippage: '0.0001',
        },
      })
        .then(result => result.data)
        .catch(e => {
          console.log(e);
          return Promise.reject(e);
        });
      const apiAmountOut = BigNumber.from(data.data.amountTokenOut).mul(
        (await core.dolomiteMargin.getMarketPrice(0)).value,
      );

      if (process.env.COVERAGE === 'true') {
        return;
      }
      const price = (await core.dolomiteMargin.getMarketPrice(await factory.marketId())).value;
      expect(apiAmountOut.div(ONE_ETH_BI)).to.be.gte(price.mul(995).div(1000));
      expect(apiAmountOut.div(ONE_ETH_BI)).to.be.lte(price.mul(1005).div(1000));
    });
  });
});
