import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { prettyPrintEncodedDataWithTypeSafety } from 'packages/deployment/src/utils/encoding/base-encoder-utils';
import {
  LowerPercentage,
  OptimalUtilizationRate,
  UpperPercentage,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeSetSupplyCapWithMagic } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import { encodeUpdateModularInterestSetterParams } from '../../../../utils/encoding/interest-setter-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Set supply cap to 1 wei for all expired Pendle PT & YT assets
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetMaxWei', [
      core.marketIds.dPtEzEthJun2024,
      ONE_BI,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetMaxWei', [
      core.marketIds.dPtEzEthSep2024,
      ONE_BI,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetMaxWei', [
      core.marketIds.dPtGlpMar2024,
      ONE_BI,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetMaxWei', [
      await core.pendleEcosystem.glpMar2024.dYtGlpMar2024.marketId(),
      ONE_BI,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetMaxWei', [
      core.marketIds.dPtGlpSep2024,
      ONE_BI,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetMaxWei', [
      core.marketIds.dPtREthJun2025,
      ONE_BI,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetMaxWei', [
      core.marketIds.dPtRsEthSep2024,
      ONE_BI,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetMaxWei',
      [61, ONE_BI], // dPtRsEthDec2024
    ),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetMaxWei', [
      core.marketIds.dPtWeEthApr2024,
      ONE_BI,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetMaxWei', [
      core.marketIds.dPtWeEthJun2024,
      ONE_BI,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetMaxWei', [
      core.marketIds.dPtWeEthSep2024,
      ONE_BI,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetMaxWei',
      [60, ONE_BI], // dPtWeEthDec2024
    ),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetMaxWei', [
      core.marketIds.dPtWstEthJun2024,
      ONE_BI,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetMaxWei', [
      core.marketIds.dPtWstEthJun2025,
      ONE_BI,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetMaxWei', [
      core.marketIds.jones,
      ONE_BI,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetMaxWei', [
      core.marketIds.premia,
      ONE_BI,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetMaxWei', [
      core.marketIds.radiant,
      ONE_BI,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetIsClosing', [
      core.marketIds.dpx,
      true,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetIsClosing', [
      core.marketIds.radiant,
      true,
    ]),
    await encodeUpdateModularInterestSetterParams(core, core.marketIds.grail, {
      lowerRate: LowerPercentage._10,
      upperRate: UpperPercentage._200,
      optimalUtilizationRate: OptimalUtilizationRate._50,
    }),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.usdc, 5_000_000),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.nativeUsdc, 500_000_000),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.weth, 200_000),
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
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);
