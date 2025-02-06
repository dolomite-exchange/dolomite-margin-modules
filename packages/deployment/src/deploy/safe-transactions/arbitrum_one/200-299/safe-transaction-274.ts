import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Sets the supply cap of PT-eETH (JUN 2024) to 1500
 * - Sets the supply cap of PT-ezETH (JUN 2024) to 750
 * - Sets the supply cap of ezETH to 50
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [];

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomite: core.dolomiteMargin },
      'dolomite',
      'ownerSetMaxWei',
      [core.marketIds.dPtWeEthJun2024, parseEther('1500')],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomite: core.dolomiteMargin },
      'dolomite',
      'ownerSetMaxWei',
      [core.marketIds.dPtEzEthJun2024, parseEther('750')],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomite: core.dolomiteMargin },
      'dolomite',
      'ownerSetMaxWei',
      [core.marketIds.ezEth, parseEther('50')],
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
      expect((await core.dolomiteMargin.getMarketMaxWei(core.marketIds.dPtWeEthJun2024)).value)
        .to
        .eq(parseEther('1500'));
      expect((await core.dolomiteMargin.getMarketMaxWei(core.marketIds.dPtEzEthJun2024)).value)
        .to
        .eq(parseEther('750'));
      expect((await core.dolomiteMargin.getMarketMaxWei(core.marketIds.ezEth)).value).to.eq(parseEther('50'));
    },
  };
}

doDryRunAndCheckDeployment(main);
