import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { AccountInfo } from '@dolomite-exchange/zap-sdk';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { ADDRESS_ZERO, BYTES_EMPTY, Network } from 'packages/base/src/utils/no-deps-constants';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

const account1: AccountInfo = {
  owner: '0xbDEf2b2051E2aE113297ee8301e011FD71A83738',
  number: '0',
};

const account2: AccountInfo = {
  owner: '0x776114a18c2f09ab3fba27c995033930f01c6824',
  number: '102787999274646061403961258370487185893560071921208163163187265968216306649689',
};

const gnosisSafe = '0xa75c21C5BE284122a87A37a76cc6C4DD3E55a1D4';

/**
 * This script encodes the following transactions:
 * - Sets the supply cap of PT-eETH (JUN 2024) to 3000
 * - Unsets the gnosis safe as a global operator
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
      [core.marketIds.dPtWeEthJun2024, parseEther('3000')],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomite: core.dolomiteMargin },
      'dolomite',
      'ownerSetGlobalOperator',
      [gnosisSafe, false],
    ),
  );

  // Don't encode this in the transactions
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    { dolomite: core.dolomiteMargin },
    'dolomite',
    'operate',
    [
      [account1, account2],
      [
        {
          actionType: '2', // transfer
          accountId: 0,
          amount: {
            value: '1056000000',
            sign: false,
            ref: '0', // delta
            denomination: '0', // wei
          },
          primaryMarketId: core.marketIds.usdc,
          secondaryMarketId: 0,
          otherAddress: ADDRESS_ZERO,
          otherAccountId: 1,
          data: BYTES_EMPTY,
        },
      ],
    ],
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
        .eq(parseEther('3000'));

      expect(await core.dolomiteMargin.getIsGlobalOperator(gnosisSafe)).to.eq(false);
    },
  };
}

doDryRunAndCheckDeployment(main);
