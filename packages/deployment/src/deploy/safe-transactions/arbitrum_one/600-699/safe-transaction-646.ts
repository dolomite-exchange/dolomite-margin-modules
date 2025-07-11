import { ActionType } from '@dolomite-exchange/dolomite-margin/dist/src';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { BYTES_ZERO, Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { ADDRESS_ZERO } from '@dolomite-exchange/zap-sdk/dist/src/lib/Constants';
import { AmountDenomination, AmountReference } from '@dolomite-margin/dist/src';
import { parseEther } from 'ethers/lib/utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Sets the security council
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const solidAccount = {
    owner: '0x3380AF548a4553F2ACFD8903A77b5E38Cfa3BD36', // handler vault
    number: '19154383098825127659749542314717481892380826245536813360181707831521304432102',
  };
  const liquidAccount = {
    owner: '0x4C5496FbF886cb8Aa6851c3e1b2eFAF9E05a19c8',
    number: '64951123557755729741927435463071110693361021642425343296420891935110551594454',
  };

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(core, { dolomite: core.dolomiteMargin }, 'dolomite', 'operate', [
      [solidAccount, liquidAccount],
      [
        {
          actionType: ActionType.Liquidate,
          accountId: 0, // solid account
          otherAccountId: 1, // liquid account
          primaryMarketId: core.marketIds.weth,
          secondaryMarketId: core.marketIds.dGmGmxUsd,
          amount: {
            value: parseEther(`${85}`),
            sign: true,
            denomination: AmountDenomination.Wei,
            ref: AmountReference.Delta,
          },
          otherAddress: ADDRESS_ZERO,
          data: BYTES_ZERO,
        },
      ],
    ]),
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
