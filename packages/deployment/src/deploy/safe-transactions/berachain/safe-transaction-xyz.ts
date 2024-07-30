import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { ADDRESS_ZERO, Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import {
  EncodedTransaction,
  prettyPrintEncodeAddMarket,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';
import { IERC20, IERC20Metadata__factory, TestPriceOracle__factory } from '@dolomite-exchange/modules-base/src/types';
import ModuleDeployments from '../../deployments.json';
import {
  CoreProtocolBerachain,
} from '@dolomite-exchange/modules-base/test/utils/core-protocols/core-protocol-berachain';
import { BigNumberish } from 'ethers';

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
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { testPriceOracle },
      'testPriceOracle',
      'setPrice',
      [token.address, price],
    ),
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
    transactions.push(
      ...await encodeTestOracle(
        core.tokens.wbera,
        '50000000000000000000',
        core,
      ),
    );
  }

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
    invariants: async () => {
      console.log(
        '\t Price for wbera',
        (await core.dolomiteMargin.getMarketPrice(core.marketIds.wbera)).value.toString(),
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
