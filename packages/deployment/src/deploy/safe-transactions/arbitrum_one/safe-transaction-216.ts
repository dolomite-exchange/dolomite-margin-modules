import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { getPendlePtEEthPriceOracleConstructorParams } from '@dolomite-exchange/modules-pendle/src/pendle-constructors';
import { PendlePtIsolationModeVaultFactory__factory } from '@dolomite-exchange/modules-pendle/src/types';
import { formatEther, parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network, ONE_BI } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Deploys PT-weETH
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const ptWeEthPriceOracleAddress = await deployContractAndSave(
    'PendlePtEEthPriceOracle',
    getPendlePtEEthPriceOracleConstructorParams(
      core,
      PendlePtIsolationModeVaultFactory__factory.connect(core.tokens.dPtWeEthApr2024.address, core.hhUser1),
      core.pendleEcosystem.weEthApr2024.pendleRegistry,
    ),
    'PendlePtEEthPriceOracleV1',
  );

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetPriceOracle',
      [core.marketIds.dPtWeEthApr2024, ptWeEthPriceOracleAddress],
    ),
  ];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    invariants: async () => {
      // NOTE: this price is time sensitive
      const price = await core.dolomiteMargin.getMarketPrice(core.marketIds.dPtWeEthApr2024);
      console.log('\t>\tCurrent price:', formatEther(price.value));
      assertHardhatInvariant(
        price.value.gt(parseEther('3780')),
        'Price is too low',
      );
      assertHardhatInvariant(
        price.value.lt(parseEther('3830')),
        'Price is too high',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
