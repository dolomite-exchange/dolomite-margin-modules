import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { deploySimpleIsolationModeSystem } from '../../../../utils/deploy-utils';
import { encodeAddIsolationModeMarket, encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import {
  LowerPercentage,
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { parseEther } from 'ethers/lib/utils';
import { encodeInsertConstantPriceOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import { encodeUpdateModularInterestSetterParams } from '../../../../utils/encoding/interest-setter-encoder-utils';
import { checkMarket, printPriceForVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - List savETH
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const { factory, unwrapper, wrapper } = await deploySimpleIsolationModeSystem(
    core,
    'SavEth',
    core.tokens.savEth,
    [core.marketIds.weth],
    [core.marketIds.weth],
  );

  const transactions: EncodedTransaction[] = [
    await encodeUpdateModularInterestSetterParams(core, core.marketIds.weth, { lowerRate: LowerPercentage._4 }),
    ...(await encodeInsertConstantPriceOracleV3(core, factory, parseEther('1'), core.tokens.savEth.address)),
    ...(await encodeInsertConstantPriceOracleV3(core, core.tokens.savEth, parseEther('1'), core.tokens.weth.address)),
    ...(await encodeAddMarket(
      core,
      core.marketIds.savEth,
      core.tokens.savEth,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      ONE_BI,
      ZERO_BI,
      true,
    )),
    ...(await encodeAddIsolationModeMarket(
      core,
      factory,
      core.oracleAggregatorV2,
      unwrapper,
      wrapper,
      core.marketIds.savEth,
      TargetCollateralization._125,
      TargetLiquidationPenalty._8,
      parseEther(`${5_000}`),
    )),
  ];

  return {
    core,
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: core.network,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    scriptName: getScriptName(__filename),
    invariants: async () => {
      await checkMarket(core, core.marketIds.savEth, core.tokens.savEth);
      await checkMarket(core, core.marketIds.dSavEth, core.tokens.dSavEth);
      await printPriceForVisualCheck(core, core.tokens.dSavEth);
      await printPriceForVisualCheck(core, core.tokens.savEth);
      await printPriceForVisualCheck(core, core.tokens.weth);
    },
  };
}

doDryRunAndCheckDeployment(main);
