import { ActionType } from '@dolomite-exchange/dolomite-margin/dist/src';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import {
  ADDRESS_ZERO,
  BYTES_EMPTY,
  Network,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { AccountInfo } from '@dolomite-exchange/zap-sdk';
import { AmountDenomination, AmountReference } from '@dolomite-margin/dist/src';
import { JonesUSDCIsolationModeTokenVaultV4__factory } from 'packages/jones/src/types';
import { CoreProtocolArbitrumOne } from '../../../../../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import Suppliers from './jusdc-suppliers-2.json';

const CURSOR = 1;

async function encodeOperateCall(core: CoreProtocolArbitrumOne, supplierChunk: AccountInfo[]) {
  return prettyPrintEncodedDataWithTypeSafety(
    core,
    { dolomite: core.dolomiteMargin },
    'dolomite',
    'operate',
    [
      [
        {
          owner: core.gnosisSafeAddress,
          number: '43287597463652610515776048249960222426297783800506298849863681408039822024105',
        },
        ...supplierChunk.map((supplier) => ({
          owner: supplier.owner,
          number: ZERO_BI,
        })),
      ],
      await Promise.all(
        supplierChunk.map(async (supplier, i) => {
          const vault = JonesUSDCIsolationModeTokenVaultV4__factory.connect(supplier.owner, core.hhUser1);
          return {
            actionType: ActionType.Transfer,
            accountId: 0,
            otherAccountId: 1 + i,
            otherAddress: ADDRESS_ZERO,
            data: BYTES_EMPTY,
            secondaryMarketId: ZERO_BI,
            primaryMarketId: core.marketIds.djUsdcV2,
            amount: {
              value: await vault.underlyingBalanceOf(),
              sign: false,
              ref: AmountReference.Delta,
              denomination: AmountDenomination.Wei,
            },
          };
        }),
      ),
    ],
    { skipWrappingCalldataInSubmitTransaction: true },
  );
}

/**
 * This script encodes the following transactions:
 * - Execute final settlement against chunked positions
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const supplierChunk = Object.keys(
    Suppliers.reduce((acc, supplier) => {
      acc[supplier.owner] = true;
      return acc;
    }, {} as Record<string, boolean>),
  )
    .map((s) => ({ owner: s, number: 0 }))
    .slice(33 * CURSOR, (CURSOR + 1) * 33);
  const transactions: EncodedTransaction[] = [await encodeOperateCall(core, supplierChunk)];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
      logGasUsage: true,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);
