import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { isIsolationMode } from 'packages/base/test/utils/dolomite';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from 'packages/deployment/src/utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from 'packages/deployment/src/utils/dry-run-utils';
import getScriptName from 'packages/deployment/src/utils/get-script-name';

const OLD_ADDRESSES: Record<'GenericTraderProxyV1' | 'LiquidatorProxyV4WithGenericTrader', any> = {
  GenericTraderProxyV1: {
    address: '0xe50c3118349f09abafc1bb01ad5cb946b1de83f6',
    transactionHash: '0xb74148f90d9cba2bcfcca7c7189bff24c72705339afc64577d71f498a8fbda39',
  },
  LiquidatorProxyV4WithGenericTrader: {
    address: '0x34975624E992bF5c094EF0CF3344660f7AaB9CB3',
    transactionHash: '0x865d8530dc2ff97a3a42739ba1ba0aaf59960ec8f74f47cec2bc0a1495cb6ada',
  },
};

/**
 * This script encodes the following transactions:
 * - Removes the old GenericTraderProxy as a global operator of Dolomite Margin
 * - Removes the old LiquidatorProxyV4 as a global operator of Dolomite Margin
 * - For each isolation mode asset, removes the old LiquidatorProxyV4 from the LiquidatorAssetRegistry
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      OLD_ADDRESSES.GenericTraderProxyV1.address,
      false,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      OLD_ADDRESSES.LiquidatorProxyV4WithGenericTrader.address,
      false,
    ]),
  );

  const numMarkets = await core.dolomiteMargin.getNumMarkets();
  for (let i = 0; numMarkets.gt(i); i++) {
    if (await isIsolationMode(i, core)) {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          core,
          'liquidatorAssetRegistry',
          'ownerRemoveLiquidatorFromAssetWhitelist',
          [i, OLD_ADDRESSES.LiquidatorProxyV4WithGenericTrader.address],
        ),
      );
    }
  }

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: network,
    },
    invariants: async () => {
      assertHardhatInvariant(
        !(await core.dolomiteMargin.getIsGlobalOperator(OLD_ADDRESSES.GenericTraderProxyV1.address)),
        'Invalid global operator',
      );
      assertHardhatInvariant(
        !(await core.dolomiteMargin.getIsGlobalOperator(OLD_ADDRESSES.LiquidatorProxyV4WithGenericTrader.address)),
        'Invalid global operator',
      );

      const numMarkets = await core.dolomiteMargin.getNumMarkets();
      for (let i = 0; numMarkets.gt(i); i++) {
        if (await isIsolationMode(i, core)) {
          assertHardhatInvariant(
            !(await core.liquidatorAssetRegistry.isAssetWhitelistedForLiquidation(
              i,
              OLD_ADDRESSES.LiquidatorProxyV4WithGenericTrader.address,
            )),
            'Invalid liquidator proxy',
          );
        }
      }
    },
  };
}

doDryRunAndCheckDeployment(main);
