import {
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
} from '@dolomite-exchange/modules-base/src/types';
import {
  CHAINLINK_PRICE_AGGREGATORS_MAP,
  REDSTONE_PRICE_AGGREGATORS_MAP,
} from '@dolomite-exchange/modules-base/src/utils/constants';
import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  getRealLatestBlockNumber,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { setupCoreProtocol, setupTestMarket } from '@dolomite-exchange/modules-base/test/utils/setup';
import axios from 'axios';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { TokenInfo } from 'packages/oracles/src';
import {
  getChainlinkPriceOracleV3ConstructorParamsFromChainlinkOracleV1,
  getRedstonePriceOracleV3ConstructorParams,
} from 'packages/oracles/src/oracles-constructors';
import {
  ChainlinkPriceOracleV3,
  ChainlinkPriceOracleV3__factory,
  IChainlinkAggregator__factory,
  OracleAggregatorV2,
  OracleAggregatorV2__factory,
  RedstonePriceOracleV3,
  RedstonePriceOracleV3__factory,
} from 'packages/oracles/src/types';
import { PendlePtIsolationModeVaultFactory, PendlePtPriceOracleV2, PendleRegistry } from '../../src/types';
import {
  createPendlePtIsolationModeTokenVaultV1,
  createPendlePtIsolationModeVaultFactory,
  createPendlePtPriceOracleV2,
  createPendleRegistry,
} from '../pendle-ecosystem-utils';

const EETH = '0x35fA164735182de50811E8e2E824cFb9B6118ac2';

describe('PendlePtEEthApr2024PriceOracleV2_integration', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let ptOracle: PendlePtPriceOracleV2;
  let pendleRegistry: PendleRegistry;
  let factory: PendlePtIsolationModeVaultFactory;
  let oracleAggregator: OracleAggregatorV2;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: await getRealLatestBlockNumber(true, Network.ArbitrumOne),
      network: Network.ArbitrumOne,
    });

    const redstoneOracle = (await createContractWithAbi<RedstonePriceOracleV3>(
      RedstonePriceOracleV3__factory.abi,
      RedstonePriceOracleV3__factory.bytecode,
      getRedstonePriceOracleV3ConstructorParams(
        core,
        [core.tokens.weEth.address],
        [
          REDSTONE_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][core.tokens.weEth.address]!.aggregatorAddress,
        ],
        [false],
      ),
    )).connect(core.governance);

    const dolomiteRegistryImplementation = await createContractWithAbi<DolomiteRegistryImplementation>(
      DolomiteRegistryImplementation__factory.abi,
      DolomiteRegistryImplementation__factory.bytecode,
      [],
    );
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(dolomiteRegistryImplementation.address);
    await core.dolomiteRegistry.connect(core.governance).ownerSetRedstonePriceOracle(redstoneOracle.address);
    const chainlinkOracle = (await createContractWithAbi<ChainlinkPriceOracleV3>(
      ChainlinkPriceOracleV3__factory.abi,
      ChainlinkPriceOracleV3__factory.bytecode,
      await getChainlinkPriceOracleV3ConstructorParamsFromChainlinkOracleV1(core),
    )).connect(core.governance);
    await chainlinkOracle.connect(core.governance).ownerInsertOrUpdateOracleToken(
      EETH,
      CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][core.tokens.weEth.address]!.aggregatorAddress,
      true,
    );
    await core.dolomiteRegistry.connect(core.governance).ownerSetChainlinkPriceOracle(
      chainlinkOracle.address,
    );

    pendleRegistry = await createPendleRegistry(
      core,
      core.pendleEcosystem!.weEthApr2024.weEthMarket,
      core.pendleEcosystem!.weEthApr2024.ptOracle,
      core.pendleEcosystem!.syWeEthToken,
    );
    const userVaultImplementation = await createPendlePtIsolationModeTokenVaultV1();
    factory = await createPendlePtIsolationModeVaultFactory(
      core,
      pendleRegistry,
      core.pendleEcosystem!.weEthApr2024.ptWeEthToken,
      userVaultImplementation,
    );

    ptOracle = await createPendlePtPriceOracleV2(core, factory, pendleRegistry);

    const tokenInfos: TokenInfo[] = [
      {
        oracleInfos: [
          { oracle: chainlinkOracle.address, tokenPair: ADDRESS_ZERO, weight: 100 },
        ],
        decimals: 18,
        token: core.tokens.weth.address,
      },
      {
        oracleInfos: [
          { oracle: redstoneOracle.address, tokenPair: core.tokens.weth.address, weight: 100 },
        ],
        decimals: 18,
        token: core.tokens.weEth.address,
      },
      {
        oracleInfos: [
          { oracle: chainlinkOracle.address, tokenPair: core.tokens.weEth.address, weight: 100 },
        ],
        decimals: 18,
        token: EETH,
      },
      {
        oracleInfos: [
          { oracle: ptOracle.address, tokenPair: EETH, weight: 100 },
        ],
        decimals: 18,
        token: factory.address,
      },
    ];
    oracleAggregator = (await createContractWithAbi<OracleAggregatorV2>(
      OracleAggregatorV2__factory.abi,
      OracleAggregatorV2__factory.bytecode,
      [
        tokenInfos,
        core.dolomiteMargin.address,
      ],
    )).connect(core.governance);
    await core.dolomiteRegistry.connect(core.governance).ownerSetOracleAggregator(oracleAggregator.address);

    await setupTestMarket(core, factory, true, oracleAggregator);
    await factory.connect(core.governance).ownerInitialize([]);
    await ptOracle.connect(core.governance).ownerSetDeductionCoefficient(parseEther('.001'));

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
          marketAddr: core.pendleEcosystem.weEthApr2024.weEthMarket.address,
          amountPtIn: ONE_ETH_BI.toString(),
          tokenOutAddr: ADDRESS_ZERO,
          syTokenOutAddr: core.tokens.weEth.address,
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
