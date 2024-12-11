import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  deployDolomiteErc4626Token,
  deployDolomiteErc4626WithPayableToken,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Creates dTokens for each listed market
 * - Sets each dToken as a global operator
 */
async function main(): Promise<DryRunOutput<Network.BerachainCartio>> {
  const network = await getAndCheckSpecificNetwork(Network.BerachainCartio);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const weth = await deployDolomiteErc4626Token(core, 'Weth', core.marketIds.weth);
  const wbera = await deployDolomiteErc4626WithPayableToken(core, 'WBera', core.marketIds.wbera);
  const usdc = await deployDolomiteErc4626Token(core, 'Usdc', core.marketIds.usdc);
  const honey = await deployDolomiteErc4626Token(core, 'Honey', core.marketIds.honey);
  const wbtc = await deployDolomiteErc4626Token(core, 'Wbtc', core.marketIds.wbtc);
  const usdt = await deployDolomiteErc4626Token(core, 'Usdt', core.marketIds.usdt);

  const transactions: EncodedTransaction[] = [];

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [weth.address, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [wbera.address, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [usdc.address, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [honey.address, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [wbtc.address, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [usdt.address, true],
    ),
  );
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
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(weth.address),
        'weth is not a global operator',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(wbera.address),
        'wbera is not a global operator',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(usdc.address),
        'usdc is not a global operator',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(honey.address),
        'honey is not a global operator',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(wbtc.address),
        'wbtc is not a global operator',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(usdt.address),
        'usdt is not a global operator',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
