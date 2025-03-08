import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Updates the supply cap for ezETH, rsETH, and weETH
 * - Allows ezETH and weETH to be borrowed
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetMaxWei',
      [core.marketIds.ezEth, parseEther(`${4_000}`)],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetMaxWei',
      [core.marketIds.rsEth, parseEther(`${4_000}`)],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetMaxWei',
      [core.marketIds.weEth, parseEther(`${5_000}`)],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetIsClosing',
      [core.marketIds.ezEth, false],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetIsClosing',
      [core.marketIds.weEth, false],
    ),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    invariants: async () => {
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketMaxWei(core.marketIds.ezEth)).value.eq(parseEther(`${4_000}`)),
        'Invalid supply cap for ezETH',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketMaxWei(core.marketIds.rsEth)).value.eq(parseEther(`${4_000}`)),
        'Invalid supply cap for rsEth',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketMaxWei(core.marketIds.weEth)).value.eq(parseEther(`${5_000}`)),
        'Invalid supply cap for weEth',
      );

      assertHardhatInvariant(
        !await core.dolomiteMargin.getMarketIsClosing(core.marketIds.ezEth),
        'Invalid closing state for ezETH',
      );
      assertHardhatInvariant(
        !await core.dolomiteMargin.getMarketIsClosing(core.marketIds.rsEth),
        'Invalid closing state for rsEth',
      );
      assertHardhatInvariant(
        !await core.dolomiteMargin.getMarketIsClosing(core.marketIds.weEth),
        'Invalid closing state for weEth',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
