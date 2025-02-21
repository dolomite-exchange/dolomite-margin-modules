import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  deployDolomiteErc4626Token,
  deployDolomiteErc4626WithPayableToken,

} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Deploys the 4626 dToken vaults for: USDC and WETH
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const dUsdcToken = await deployDolomiteErc4626Token(core, 'Usdc', core.marketIds.usdc);
  const dWBeraToken = await deployDolomiteErc4626WithPayableToken(core, 'WBera', core.marketIds.wbera);
  const dWethToken = await deployDolomiteErc4626Token(core, 'Weth', core.marketIds.weth);

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      dUsdcToken.address,
      true,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      dWBeraToken.address,
      true,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      dWethToken.address,
      true,
    ]),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
    },
    invariants: async () => {
      const isGlobalOperator = (o: string) => core.dolomiteMargin.getIsGlobalOperator(o);

      assertHardhatInvariant(await isGlobalOperator(dUsdcToken.address), 'dUsdcToken is not a global operator');
      assertHardhatInvariant(await isGlobalOperator(dWBeraToken.address), 'dWBeraToken is not a global operator');
      assertHardhatInvariant(await isGlobalOperator(dWethToken.address), 'dWethToken is not a global operator');
    },
  };
}

doDryRunAndCheckDeployment(main);
