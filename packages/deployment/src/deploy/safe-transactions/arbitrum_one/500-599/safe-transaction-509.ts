import { ActionType } from '@dolomite-exchange/dolomite-margin/dist/src';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { AmountDenomination, AmountReference } from '@dolomite-margin/dist/src';
import { parseEther } from 'ethers/lib/utils';
import { expectProtocolBalance } from '../../../../../../base/test/utils/assertions';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * -Deposit funds into the vault that is frozen
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const vault = '0x8AFaA91E86f62a4b49a0C9dfF35B76a926B0180A';
  const amountWei = parseEther('15');

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxV2Ecosystem.gmTokens.pendleUsd,
      'marketToken',
      'approve',
      [vault, amountWei],
      { skipWrappingCalldataInSubmitTransaction: true },
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxV2Ecosystem.live.gmPendleUsd,
      'factory',
      'enqueueTransferIntoDolomiteMargin',
      [vault, amountWei],
      { skipWrappingCalldataInSubmitTransaction: true },
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomite: core.dolomiteMargin },
      'dolomite',
      'operate',
      [
        [{ owner: vault, number: ZERO_BI }],
        [
          {
            actionType: ActionType.Deposit,
            accountId: 0,
            amount: { sign: true, value: amountWei, ref: AmountReference.Delta, denomination: AmountDenomination.Wei },
            primaryMarketId: core.marketIds.dGmPendleUsd,
            secondaryMarketId: 0,
            otherAddress: core.gnosisSafeAddress,
            otherAccountId: 0,
            data: BYTES_EMPTY,
          },
        ],
      ],
      { skipWrappingCalldataInSubmitTransaction: true },
    ),
  ];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
    },
    invariants: async () => {
      await expectProtocolBalance(core, vault, ZERO_BI, core.marketIds.dGmPendleUsd, amountWei);
    },
  };
}

doDryRunAndCheckDeployment(main);
