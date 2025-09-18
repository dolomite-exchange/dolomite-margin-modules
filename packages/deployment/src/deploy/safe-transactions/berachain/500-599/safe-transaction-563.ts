import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  LowerPercentage,
  OptimalUtilizationRate,
  UpperPercentage,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import { encodeModularInterestSetterParams } from '../../../../utils/encoding/interest-setter-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

const ORIGINAL_ADDRESSES = [
  '0x2a6334C30f36D1EEfd64689c590Dd199D3475972',
  '0xAF4b80f380A920596fBD3465f8961B2246025b4C',
];
const NEW_ADDRESSES = [
  '0xb6Be1231C7402F2AdB2f7F6888aB991eF8583bD3',
  '0x473F13c81Fc12C10c27eC08294a9D2B921827D96',
];

/**
 * This script encodes the following transactions:
 * - Adjust BERA interest rate model
 * - Add remapping for a user's air drop
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    await encodeModularInterestSetterParams(
      core,
      core.tokens.wbera,
      LowerPercentage._70,
      UpperPercentage._200,
      OptimalUtilizationRate._75,
    ),
    await encodeModularInterestSetterParams(
      core,
      core.tokens.iBera,
      LowerPercentage._70,
      UpperPercentage._200,
      OptimalUtilizationRate._75,
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
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);
