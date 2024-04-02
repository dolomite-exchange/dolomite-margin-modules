import {
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
} from '@dolomite-exchange/modules-base/src/types';
import { CHAINLINK_PRICE_AGGREGATORS_MAP, WE_ETH_ETH_REDSTONE_FEED_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import {
  setupCoreProtocol,
  setupTestMarket,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  IERC20,
  PendlePtIsolationModeVaultFactory,
  PendlePtPriceOracleV2,
  PendleRegistry,
} from '../../src/types';
import {
  createPendlePtIsolationModeTokenVaultV1,
  createPendlePtIsolationModeVaultFactory,
  createPendlePtPriceOracleV2,
  createPendleRegistry,
} from '../pendle-ecosystem-utils';
import { ChainlinkPriceOracleV3, ChainlinkPriceOracleV3__factory, OracleAggregator, OracleAggregator__factory, RedstonePriceOracleV3, RedstonePriceOracleV3__factory } from 'packages/oracles/src/types';
import { setNextBlockTimestamp } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { getChainlinkPriceOracleV3ConstructorParamsFromChainlinkOracleV1, getOracleAggregatorV1ConstructorParams, getRedstonePriceOracleV3ConstructorParams } from 'packages/oracles/src/oracles-constructors';
import axios from 'axios';

const PT_E_ETH_PRICE = BigNumber.from('3689824302982898438870');

describe('PendlePtEEthApr2024PriceOracleV2', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let ptOracle: PendlePtPriceOracleV2;
  let pendleRegistry: PendleRegistry;
  let factory: PendlePtIsolationModeVaultFactory;
  let oracleAggregator: OracleAggregator;
  let underlyingToken: IERC20;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 187_700_000,
      network: Network.ArbitrumOne,
    });

    underlyingToken = core.tokens.weEth!;
    const wethAggregator = await core.chainlinkPriceOracle!.getAggregatorByToken(core.tokens.weth.address);
    const weEthAggregator = WE_ETH_ETH_REDSTONE_FEED_MAP[Network.ArbitrumOne];
    const redstoneOracle = (await createContractWithAbi<RedstonePriceOracleV3>(
      RedstonePriceOracleV3__factory.abi,
      RedstonePriceOracleV3__factory.bytecode,
      await getRedstonePriceOracleV3ConstructorParams(
        [core.tokens.weEth],
        [weEthAggregator],
        [false],
        core
      )
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
    await core.dolomiteRegistry.connect(core.governance).ownerSetChainlinkPriceOracle(
      chainlinkOracle.address
    );
    oracleAggregator = (await createContractWithAbi<OracleAggregator>(
      OracleAggregator__factory.abi,
      OracleAggregator__factory.bytecode,
      await getOracleAggregatorV1ConstructorParams(core, chainlinkOracle, redstoneOracle),
    )).connect(core.governance);
    const eEth = '0x35fA164735182de50811E8e2E824cFb9B6118ac2';
    await chainlinkOracle.connect(core.governance).ownerInsertOrUpdateOracleToken(
      eEth,
      18,
      CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][core.tokens.weEth.address],
      true
    );
    await oracleAggregator.ownerInsertOrUpdateOracle(
      eEth,
      chainlinkOracle.address,
      core.tokens.weEth.address
    );

    pendleRegistry = await createPendleRegistry(
      core,
      core.pendleEcosystem!.weEthApr2024.ptWeEthMarket,
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
    await oracleAggregator.ownerInsertOrUpdateOracle(
      factory.address,
      ptOracle.address,
      eEth
    );
    await setupTestMarket(core, factory, true, oracleAggregator);

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
      await setNextBlockTimestamp(1709735900);
      const price = await ptOracle.getPrice(factory.address);
      expect(price.value).to.eq(PT_E_ETH_PRICE);
    });

    it.only('test', async () => {
      const marketId = await core.dolomiteMargin.getNumMarkets();
      const BASE_URL = 'https://api-v2.pendle.finance/sdk/api/v1';
      const data = await axios.get(`${BASE_URL}/swapExactPtForToken`, {
        params: {
          chainId: Network.ArbitrumOne.toString(),
          receiverAddr: core.hhUser1.address.toLowerCase(),
          marketAddr: core.pendleEcosystem.weEthApr2024.ptWeEthMarket.address,
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
      const apiAmountOut = BigNumber.from(data.data.amountTokenOut).mul((await core.dolomiteMargin.getMarketPrice(0)).value);
      console.log('apiAmountOut: ', apiAmountOut.div(ONE_ETH_BI).toString());
      console.log('price from aggregator: ', (await core.dolomiteMargin.getMarketPrice(marketId.sub(1))).toString());
    });
  });
});
