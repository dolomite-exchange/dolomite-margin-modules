import {
  CHAINLINK_PRICE_AGGREGATORS_MAP,
  WE_ETH_ETH_REDSTONE_FEED_MAP,
} from '@dolomite-exchange/modules-base/src/utils/constants';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { getRedstonePriceOracleConstructorParams } from '@dolomite-exchange/modules-oracles/src/oracles-constructors';
import { RedstonePriceOracle__factory } from '@dolomite-exchange/modules-oracles/src/types';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { ADDRESS_ZERO, Network, ONE_BI } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  deployPendlePtSystem,
  EncodedTransaction,
  prettyPrintEncodeAddIsolationModeMarket,
  prettyPrintEncodeAddMarket,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Deploys PT-weETH
 * - Deploys PT-rsETH
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });
  let incrementor = 0;

  const wethAggregator = await core.chainlinkPriceOracle!.getAggregatorByToken(core.tokens.weth.address);
  const weEthAggregator = WE_ETH_ETH_REDSTONE_FEED_MAP[Network.ArbitrumOne];

  const redstonePriceOracleAddress = await deployContractAndSave(
    'RedstonePriceOracle',
    await getRedstonePriceOracleConstructorParams(
      [core.tokens.weth, core.tokens.weEth!],
      [wethAggregator, weEthAggregator],
      [ADDRESS_ZERO, core.tokens.weth.address],
      core,
    ),
    'RedstonePriceOracleV1',
  );
  const redstonePriceOracle = RedstonePriceOracle__factory.connect(redstonePriceOracleAddress, core.hhUser1);
  const numMarkets = await core.dolomiteMargin.getNumMarkets();

  const weEthMarketId = numMarkets.add(incrementor++);
  const ptWeEthMarketId = numMarkets.add(incrementor++);
  const weEthPendleSystem = await deployPendlePtSystem(
    core,
    'weETH',
    core.pendleEcosystem.weEthApr2024.ptWeEthMarket,
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
      'chainlinkPriceOracle',
      'ownerInsertOrUpdateOracleToken',
      [
        core.tokens.weEth.address,
        18,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][core.tokens.weEth.address],
        ADDRESS_ZERO,
      ],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetInterestSetter',
      [core.marketIds.weth, core.interestSetters.linearStepFunction14L86UInterestSetter.address],
    ),
    ...await prettyPrintEncodeAddMarket(
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
    ...await prettyPrintEncodeAddIsolationModeMarket(
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
        === core.interestSetters.linearStepFunction14L86UInterestSetter.address,
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
