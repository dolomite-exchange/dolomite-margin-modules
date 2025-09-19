import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

const D2_FROM_ADDRESSES = [
  '0x8cabd8b787e8c69c5f24091cfda197ff570345b3',
  '0xb01049402ab2149081fdfe23f3be1348fe0a9c98',
  '0x796dc31e15218285071984cdcbf7fb32c67c56c9',
];
const D2_TO_ADDRESSES = [
  '0x58247DdF2ccb74eF2Bc1c5ba2D6422863FdDeC77',
  '0xE4CB64681F4E111681fD1cc97a016b175518316C',
  '0x731624eAd411AF42B554d58f2ffd7e418b7Af18D',
];

/**
 * This script encodes the following transactions:
 * - Risk updates
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(core, core.tokenomics, 'rollingClaims', 'ownerSetAddressRemapping', [
      D2_TO_ADDRESSES,
      D2_FROM_ADDRESSES,
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
