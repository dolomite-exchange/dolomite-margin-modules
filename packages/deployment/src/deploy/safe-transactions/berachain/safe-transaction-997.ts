import { IERC20, TestPriceOracle__factory } from '@dolomite-exchange/modules-base/src/types';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { CoreProtocolBerachain } from '@dolomite-exchange/modules-base/test/utils/core-protocols/core-protocol-berachain';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { BigNumberish } from 'ethers';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';
import ModuleDeployments from '../../deployments.json';

async function encodeTestOracle(
  token: IERC20,
  price: BigNumberish,
  core: CoreProtocolBerachain,
): Promise<EncodedTransaction[]> {
  const testPriceOracle = TestPriceOracle__factory.connect(
    ModuleDeployments.TestPriceOracle['80084'].address,
    core.hhUser1,
  );

  return [
    await prettyPrintEncodedDataWithTypeSafety(core, { testPriceOracle }, 'testPriceOracle', 'setPrice', [
      token.address,
      price,
    ]),
  ];
}

/**
 * This script encodes the following transactions:
 * - Adds the WETH, BERA, and HONEY markets
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];

  if (network === '80084') {
    console.log('\tSetting test prices for Bera Bartio...');
    transactions.push(...(await encodeTestOracle(core.tokens.weth, '1', core)));
    transactions.push(...(await encodeTestOracle(core.tokens.usdc, '1', core)));
  }
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomite: core.dolomiteMargin },
      'dolomite',
      'ownerSetMaxSupplyWei',
      [core.marketIds.weth, '1'],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomite: core.dolomiteMargin },
      'dolomite',
      'ownerSetMaxSupplyWei',
      [core.marketIds.usdc, '1'],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomite: core.dolomiteMargin },
      'dolomite',
      'ownerSetMaxBorrowWei',
      [core.marketIds.weth, '1'],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomite: core.dolomiteMargin },
      'dolomite',
      'ownerSetMaxBorrowWei',
      [core.marketIds.usdc, '1'],
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
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);
