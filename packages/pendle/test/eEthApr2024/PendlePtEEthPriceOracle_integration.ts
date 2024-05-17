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
import { setupCoreProtocol, setupTestMarket } from '@dolomite-exchange/modules-base/test/utils/setup';
import axios from 'axios';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import {
  getChainlinkPriceOracleV2ConstructorParamsFromOldPriceOracle,
  getRedstonePriceOracleV2ConstructorParams,
} from 'packages/oracles/src/oracles-constructors';
import {
  ChainlinkPriceOracleV2,
  ChainlinkPriceOracleV2__factory,
  RedstonePriceOracleV2,
  RedstonePriceOracleV2__factory,
} from '@dolomite-exchange/modules-oracles/src/types';
import { IERC20, PendlePtIsolationModeVaultFactory, PendlePtPriceOracle, PendleRegistry } from '../../src/types';
import {
  createPendlePtEEthPriceOracle,
  createPendlePtIsolationModeTokenVaultV1,
  createPendlePtIsolationModeVaultFactory,
  createPendleRegistry,
} from '../pendle-ecosystem-utils';

describe('PendlePtEEthApr2024PriceOracle_integration', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let ptOracle: PendlePtPriceOracle;
  let pendleRegistry: PendleRegistry;
  let factory: PendlePtIsolationModeVaultFactory;
  let underlyingToken: IERC20;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: await getRealLatestBlockNumber(true, Network.ArbitrumOne),
      network: Network.ArbitrumOne,
    });

    underlyingToken = core.tokens.weEth!;
    const wethAggregator = await core.chainlinkPriceOracleV1!.getAggregatorByToken(core.tokens.weth.address);
    const redstoneAggregatorMap = REDSTONE_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne];
    const weEthAggregator = redstoneAggregatorMap[core.tokens.weEth.address]!.aggregatorAddress;
    const redstoneOracle = (await createContractWithAbi<RedstonePriceOracleV2>(
      RedstonePriceOracleV2__factory.abi,
      RedstonePriceOracleV2__factory.bytecode,
      await getRedstonePriceOracleV2ConstructorParams(
        [core.tokens.weth, underlyingToken],
        [wethAggregator, weEthAggregator],
        [ADDRESS_ZERO, core.tokens.weth.address],
        [false, false],
        core,
      ),
    )).connect(core.governance);

    const dolomiteRegistryImplementation = await createContractWithAbi<DolomiteRegistryImplementation>(
      DolomiteRegistryImplementation__factory.abi,
      DolomiteRegistryImplementation__factory.bytecode,
      [],
    );
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(dolomiteRegistryImplementation.address);
    await core.dolomiteRegistry.connect(core.governance).ownerSetRedstonePriceOracle(redstoneOracle.address);
    const chainlinkOracle = (await createContractWithAbi<ChainlinkPriceOracleV2>(
      ChainlinkPriceOracleV2__factory.abi,
      ChainlinkPriceOracleV2__factory.bytecode,
      await getChainlinkPriceOracleV2ConstructorParamsFromOldPriceOracle(core),
    )).connect(core.governance);
    await core.dolomiteRegistry.connect(core.governance).ownerSetChainlinkPriceOracle(
      chainlinkOracle.address,
    );
    await chainlinkOracle.connect(core.governance).ownerInsertOrUpdateOracleTokenWithBypass(
      underlyingToken.address,
      18,
      CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][core.tokens.weEth.address]!.aggregatorAddress,
      ADDRESS_ZERO,
      true,
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

    ptOracle = await createPendlePtEEthPriceOracle(core, factory, pendleRegistry);
    await setupTestMarket(core, factory, true, ptOracle);
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
      expect(await ptOracle.UNDERLYING_TOKEN()).to.eq(underlyingToken.address);
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
        (await core.dolomiteMargin.getMarketPrice(0)).value
      );

      if (process.env.COVERAGE === 'true') {
        return;
      }
      const price = (await ptOracle.getPrice(factory.address)).value;
      expect(apiAmountOut.div(ONE_ETH_BI)).to.be.gte(price.mul(995).div(1000));
      expect(apiAmountOut.div(ONE_ETH_BI)).to.be.lte(price.mul(1005).div(1000));
    });
  });
});
