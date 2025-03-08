import { parseEther } from 'ethers/lib/utils';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetBorrowCap,
  encodeSetInterestSetter,
  encodeSetIsCollateralOnly,
  encodeSetLiquidationPenalty,
  encodeSetMinCollateralization,
  encodeSetSupplyCap,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import { encodeInsertChronicleOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Change earnings rate for the protocol
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    ...(await encodeInsertChronicleOracleV3(core, core.tokens.fbtc)),
    ...(await encodeInsertChronicleOracleV3(core, core.tokens.nect)),
    ...(await encodeInsertChronicleOracleV3(core, core.tokens.uniBtc)),
    ...(await encodeInsertChronicleOracleV3(core, core.tokens.wbera)),
    ...(await encodeInsertChronicleOracleV3(core, core.tokens.ylStEth)),
    await encodeSetSupplyCap(core, core.marketIds.wbera, parseEther(`${2_000_000}`)),
    await encodeSetBorrowCap(core, core.marketIds.wbera, parseEther(`${1_000_000}`)),
    await encodeSetIsCollateralOnly(core, core.marketIds.wbera, false),
    await encodeSetMinCollateralization(core, core.marketIds.wbera, TargetCollateralization._150),
    await encodeSetLiquidationPenalty(core, core.marketIds.wbera, TargetLiquidationPenalty._15),
    await encodeSetInterestSetter(
      core,
      core.marketIds.wbera,
      core.interestSetters.linearStepFunction16L84U70OInterestSetter,
    ),
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
      await printPriceForVisualCheck(core, core.tokens.fbtc);
      await printPriceForVisualCheck(core, core.tokens.nect);
      await printPriceForVisualCheck(core, core.tokens.uniBtc);
      await printPriceForVisualCheck(core, core.tokens.wbera);
      await printPriceForVisualCheck(core, core.tokens.ylStEth);
    },
  };
}

doDryRunAndCheckDeployment(main);
