import {
  CHAINLINK_PRICE_AGGREGATORS_MAP,
  REDSTONE_PRICE_AGGREGATORS_MAP,
} from '@dolomite-exchange/modules-base/src/utils/constants';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { getRedstonePriceOracleV2ConstructorParams } from '@dolomite-exchange/modules-oracles/src/oracles-constructors';
import { RedstonePriceOracleV2__factory } from '@dolomite-exchange/modules-oracles/src/types';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { ADDRESS_ZERO, Network, ONE_BI } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  deployPendlePtSystem,

} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeAddIsolationModeMarket,
  encodeAddMarket,
} from '../../../../utils/encoding/add-market-encoder-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Deploys PT-weETH
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });
  let incrementor = 0;

  const wethAggregator = await core.chainlinkPriceOracleV1.getAggregatorByToken(core.tokens.weth.address);

  const aggregatorInfo = REDSTONE_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][core.tokens.weEth.address];
  const redstonePriceOracleAddress = await deployContractAndSave(
    'RedstonePriceOracle',
    await getRedstonePriceOracleV2ConstructorParams(
      [core.tokens.weth, core.tokens.weEth!],
      [wethAggregator, aggregatorInfo!.aggregatorAddress],
      [ADDRESS_ZERO, aggregatorInfo!.tokenPairAddress!],
      [false, false],
      core,
    ),
    'RedstonePriceOracleV1',
  );
  const redstonePriceOracle = RedstonePriceOracleV2__factory.connect(redstonePriceOracleAddress, core.hhUser1);
  const numMarkets = await core.dolomiteMargin.getNumMarkets();

  const weEthMarketId = numMarkets.add(incrementor++);
  const ptWeEthMarketId = numMarkets.add(incrementor++);
  const weEthPendleSystem = await deployPendlePtSystem(
    core,
    'WeETHApr2024',
    core.pendleEcosystem.weEthApr2024.weEthMarket,
    core.pendleEcosystem.weEthApr2024.ptOracle,
    core.pendleEcosystem.weEthApr2024.ptWeEthToken,
    core.pendleEcosystem.syWeEthToken,
    core.tokens.weEth,
  );

  const dolomiteRegistryAddress = await deployContractAndSave(
    'DolomiteRegistryImplementation',
    [],
    'DolomiteRegistryImplementationV7',
  );

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteRegistryProxy',
      'upgradeTo',
      [dolomiteRegistryAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteRegistry',
      'ownerSetRedstonePriceOracle',
      [redstonePriceOracle.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'chainlinkPriceOracleV1',
      'ownerInsertOrUpdateOracleToken',
      [
        core.tokens.weEth.address,
        18,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][core.tokens.weEth.address]!.aggregatorAddress,
        ADDRESS_ZERO,
      ],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetInterestSetter',
      [core.marketIds.weth, core.interestSetters.linearStepFunction14L86U90OInterestSetter.address],
    ),
    ...await encodeAddMarket(
      core,
      core.tokens.weEth,
      redstonePriceOracle,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      '1',
      '1',
      true,
    ),
    ...await encodeAddIsolationModeMarket(
      core,
      weEthPendleSystem.factory,
      weEthPendleSystem.oracle,
      weEthPendleSystem.unwrapper,
      weEthPendleSystem.wrapper,
      ptWeEthMarketId,
      TargetCollateralization._120,
      TargetLiquidationPenalty._6,
      parseEther('1000'),
    ),
  ];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    invariants: async () => {
      assertHardhatInvariant(
        await core.dolomiteMargin.getMarketInterestSetter(core.marketIds.weth)
        === core.interestSetters.linearStepFunction14L86U90OInterestSetter.address,
        'Invalid interest setter',
      );
      assertHardhatInvariant(
        await core.dolomiteRegistry.redstonePriceOracle() === redstonePriceOracle.address,
        'Invalid dolomite registry',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getMarketTokenAddress(weEthMarketId) === core.tokens.weEth.address,
        'Invalid weETH market ID',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketMaxWei(weEthMarketId)).value.eq(ONE_BI),
        'Invalid weETH supply cap',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getMarketIsClosing(weEthMarketId),
        'weETH should be closing',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getMarketTokenAddress(ptWeEthMarketId)
        === weEthPendleSystem.factory.address,
        'Invalid weETH market ID',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
