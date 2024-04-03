import {
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
} from '@dolomite-exchange/modules-base/src/types';
import {
  AggregatorInfo,
  CHAINLINK_PRICE_AGGREGATORS_MAP,
  REDSTONE_PRICE_AGGREGATORS_MAP,
} from '@dolomite-exchange/modules-base/src/utils/constants';
import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { advanceToTimestamp, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { setupCoreProtocol, setupTestMarket } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  ChainlinkPriceOracleV3,
  ChainlinkPriceOracleV3__factory,
  IChainlinkAggregator__factory,
  OracleAggregatorV2,
  OracleAggregatorV2__factory,
  RedstonePriceOracleV3,
  RedstonePriceOracleV3__factory,
} from '@dolomite-exchange/modules-oracles/src/types';
import axios from 'axios';
import { expect } from 'chai';
import { BaseContract, BigNumber } from 'ethers';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import {
  getChainlinkPriceOracleV3ConstructorParamsFromChainlinkOracleV1,
  getOracleAggregatorV2ConstructorParams,
  getRedstonePriceOracleV3ConstructorParams,
} from 'packages/oracles/src/oracles-constructors';
import {
  IERC20,
  IPendlePtIsolationModeVaultFactory__factory,
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
import * as Deployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';

const PT_E_ETH_PRICE = BigNumber.from('3689828284230479763540');

describe('PendlePtEEthApr2024PriceOracleV2', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let ptOracle: PendlePtPriceOracleV2;
  let pendleRegistry: PendleRegistry;
  let factory: PendlePtIsolationModeVaultFactory;
  let oracleAggregatorV2: OracleAggregatorV2;
  let underlyingToken: IERC20;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 187_700_000,
      network: Network.ArbitrumOne,
    });

    underlyingToken = core.tokens.weEth;
    const weEthAggregator = IChainlinkAggregator__factory.connect(
      REDSTONE_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][underlyingToken.address].aggregatorAddress,
      core.hhUser1,
    );
    const redstoneOracle = await createContractWithAbi<RedstonePriceOracleV3>(
      RedstonePriceOracleV3__factory.abi,
      RedstonePriceOracleV3__factory.bytecode,
      getRedstonePriceOracleV3ConstructorParams(
        [underlyingToken],
        [weEthAggregator],
        [false],
        core.dolomiteRegistry,
        core.dolomiteMargin,
      ),
    );

    const dolomiteRegistryImplementation = await createContractWithAbi<DolomiteRegistryImplementation>(
      DolomiteRegistryImplementation__factory.abi,
      DolomiteRegistryImplementation__factory.bytecode,
      [],
    );
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(dolomiteRegistryImplementation.address);
    await core.dolomiteRegistry.connect(core.governance).ownerSetRedstonePriceOracle(redstoneOracle.address);
    const chainlinkOracle = await createContractWithAbi<ChainlinkPriceOracleV3>(
      ChainlinkPriceOracleV3__factory.abi,
      ChainlinkPriceOracleV3__factory.bytecode,
      await getChainlinkPriceOracleV3ConstructorParamsFromChainlinkOracleV1(core),
    );
    await core.dolomiteRegistry.connect(core.governance).ownerSetChainlinkPriceOracle(chainlinkOracle.address);

    const eEth = '0x35fA164735182de50811E8e2E824cFb9B6118ac2';
    await chainlinkOracle.connect(core.governance).ownerInsertOrUpdateOracleToken(
      eEth,
      CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][underlyingToken.address].aggregatorAddress,
      true,
    );

    const tokenToNewOracleMap: Record<string, AggregatorInfo> = {};
    const tokensToOldOraclesMap: Record<string, any> = {
      [core.tokens.dPtREthJun2025.address]: {
        tokenPairAddress: core.tokens.weth.address,
        aggregatorAddress: Deployments.PendlePtREthJun2025PriceOracle[core.network].address,
        pendleRegistry: core.pendleEcosystem.rEthJun2025.pendleRegistry,
      },
      [core.tokens.dPtWeEthApr2024.address]: {
        tokenPairAddress: core.tokens.eEth.address,
        aggregatorAddress: Deployments.PendlePtWeETHApr2024PriceOracle[core.network].address,
        pendleRegistry: core.pendleEcosystem.weEthApr2024.pendleRegistry,
      },
      [core.tokens.dPtWstEthJun2024.address]: {
        tokenPairAddress: core.tokens.stEth.address,
        aggregatorAddress: Deployments.PendlePtWstEthJun2024PriceOracle[core.network].address,
        pendleRegistry: core.pendleEcosystem.wstEthJun2024.pendleRegistry,
      },
      [core.tokens.dPtWstEthJun2025.address]: {
        tokenPairAddress: core.tokens.stEth.address,
        aggregatorAddress: Deployments.PendlePtWstEthJun2024PriceOracle[core.network].address,
        pendleRegistry: core.pendleEcosystem.wstEthJun2025.pendleRegistry,
      },
      [core.tokens.grail.address]: {
        tokenPairAddress: core.tokens.weth.address,
        aggregatorAddress: Deployments.GrailTWAPPriceOracleV1[core.network].address,
        isTwap: true,
      },
      [core.tokens.jones.address]: {
        tokenPairAddress: core.tokens.weth.address,
        aggregatorAddress: Deployments.JonesTWAPPriceOracleV1[core.network].address,
        isTwap: true,
      },
      [core.tokens.premia.address]: {
        tokenPairAddress: core.tokens.weth.address,
        aggregatorAddress: Deployments.PremiaTWAPPriceOracleV1[core.network].address,
        isTwap: true,
      },
      [core.tokens.dpx.address]: {
        tokenPairAddress: core.tokens.weth.address,
        aggregatorAddress: Deployments.DPXTWAPPriceOracleV1[core.network].address,
        isTwap: true,
      },
    };
    const oldTokens = Object.keys(tokensToOldOraclesMap);
    for (let i = 0; i < oldTokens.length; i++) {
      const oldToken = oldTokens[i];
      let newOracle: BaseContract;
      if ('pendleRegistry' in tokensToOldOraclesMap[oldToken]) {
        newOracle = await createPendlePtPriceOracleV2(
          core,
          IPendlePtIsolationModeVaultFactory__factory.connect(oldToken, core.hhUser1),
          tokensToOldOraclesMap[oldToken]
        );
      } else if ('isTwap' in tokensToOldOraclesMap[oldToken]) {
        newOracle = await createPendlePtPriceOracleV2(
          core,
          IPendlePtIsolationModeVaultFactory__factory.connect(oldToken, core.hhUser1),
          tokensToOldOraclesMap[oldToken]
        );
      } else {
        throw new Error(`Invalid token ${oldToken}`);
      }

      tokenToNewOracleMap[oldToken] = {
        tokenPairAddress: tokensToOldOraclesMap[oldToken].tokenPairAddress,
        aggregatorAddress: newOracle.address,
      };
    }
    oracleAggregatorV2 = await createContractWithAbi<OracleAggregatorV2>(
      OracleAggregatorV2__factory.abi,
      OracleAggregatorV2__factory.bytecode,
      await getOracleAggregatorV2ConstructorParams(core, chainlinkOracle, redstoneOracle, tokenToNewOracleMap),
    );
    await core.dolomiteRegistry.connect(core.governance).ownerSetOracleAggregator(oracleAggregatorV2.address);

    await oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
      token: eEth,
      decimals: 18,
      oracleInfos: [
        {
          oracle: chainlinkOracle.address,
          tokenPair: underlyingToken.address,
          weight: 100,
        },
      ],
    });

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
    await oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
      token: factory.address,
      decimals: 18,
      oracleInfos: [
        {
          oracle: ptOracle.address,
          weight: 100,
          tokenPair: eEth,
        },
      ],
    });
    await setupTestMarket(core, factory, true, oracleAggregatorV2);

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

  describe('getDecimalsByToken', () => {
    it('should work normally', async () => {
      expect(await ptOracle.getDecimalsByToken(underlyingToken.address)).to.eq(18);
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value under normal conditions for the dptToken', async () => {
      await advanceToTimestamp(1709735900);
      const price = await oracleAggregatorV2.getPrice(factory.address);
      expect(price.value).to.eq(PT_E_ETH_PRICE);
    });

    it('should work with Pendle API', async () => {
      const marketId = await core.dolomiteMargin.getNumMarkets();
      const BASE_URL = 'https://api-v2.pendle.finance/sdk/api/v1';
      const data = await axios.get(`${BASE_URL}/swapExactPtForToken`, {
        params: {
          chainId: Network.ArbitrumOne.toString(),
          receiverAddr: core.hhUser1.address.toLowerCase(),
          marketAddr: core.pendleEcosystem.weEthApr2024.ptWeEthMarket.address,
          amountPtIn: ONE_ETH_BI.toString(),
          tokenOutAddr: core.tokens.nativeUsdc.address,
          syTokenOutAddr: underlyingToken.address,
          slippage: '0.0001',
        },
      })
        .then(result => result.data)
        .catch(e => {
          console.log(e);
          return Promise.reject(e);
        });
      const apiAmountOut = BigNumber.from(data.data.amountTokenOut)
        .mul((await core.dolomiteMargin.getMarketPrice(2)).value);
      console.log('apiAmountOut (live): ', apiAmountOut.div(ONE_ETH_BI).toString());
      console.log(
        'price from aggregator (static block #): ',
        (await core.dolomiteMargin.getMarketPrice(marketId.sub(1))).toString(),
      );
    });
  });
});
