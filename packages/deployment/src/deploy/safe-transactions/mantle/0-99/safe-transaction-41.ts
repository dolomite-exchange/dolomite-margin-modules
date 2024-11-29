import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployDolomiteErc4626Token,
  deployDolomiteErc4626WithPayableToken,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Deploys the 4626 dToken vaults for: DAI, USDC, USDT, WBTC, and WETH
 */
async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const dMethToken = await deployDolomiteErc4626Token(core, 'Meth', core.marketIds.meth);
  const dUsdcToken = await deployDolomiteErc4626Token(core, 'Usdc', core.marketIds.usdc);
  const dUsdtToken = await deployDolomiteErc4626Token(core, 'Usdt', core.marketIds.usdt);
  const dWbtcToken = await deployDolomiteErc4626Token(core, 'Wbtc', core.marketIds.wbtc);
  const dWethToken = await deployDolomiteErc4626Token(core, 'Weth', core.marketIds.weth);
  const dWmntToken = await deployDolomiteErc4626WithPayableToken(core, 'Wmnt', core.marketIds.wmnt);

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      dMethToken.address,
      true,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      dUsdcToken.address,
      true,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      dUsdtToken.address,
      true,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      dWbtcToken.address,
      true,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      dWethToken.address,
      true,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      dWmntToken.address,
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
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    invariants: async () => {
      const isGlobalOperator = (o: string) => core.dolomiteMargin.getIsGlobalOperator(o);

      assertHardhatInvariant(await isGlobalOperator(dMethToken.address), 'dMethToken is not a global operator');
      assertHardhatInvariant(await isGlobalOperator(dUsdcToken.address), 'dUsdcToken is not a global operator');
      assertHardhatInvariant(await isGlobalOperator(dUsdtToken.address), 'dUsdtToken is not a global operator');
      assertHardhatInvariant(await isGlobalOperator(dWbtcToken.address), 'dWbtcToken is not a global operator');
      assertHardhatInvariant(await isGlobalOperator(dWethToken.address), 'dWethToken is not a global operator');
      assertHardhatInvariant(await isGlobalOperator(dWmntToken.address), 'dWmntToken is not a global operator');
    },
  };
}

doDryRunAndCheckDeployment(main);
