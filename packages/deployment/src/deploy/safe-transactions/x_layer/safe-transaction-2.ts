import { IERC20Metadata__factory } from '@dolomite-exchange/modules-base/src/types';
import { getChainlinkPriceAggregatorByToken } from '@dolomite-exchange/modules-base/src/utils/constants';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { parseUsdt, parseWbtc } from '@dolomite-exchange/modules-base/src/utils/math-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  getChainlinkPriceOracleV3ConstructorParams,
} from '@dolomite-exchange/modules-oracles/src/oracles-constructors';
import { OkxPriceOracleV3__factory } from '@dolomite-exchange/modules-oracles/src/types';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { ADDRESS_ZERO, Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodeAddMarket,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Sets the interest setter on WETH
 * - Sets the price oracle on WETH
 * - Adds the USDC, DAI, LINK, and MATIC markets
 */
async function main(): Promise<DryRunOutput<Network.XLayer>> {
  const network = await getAndCheckSpecificNetwork(Network.XLayer);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { distributor: core.mineralLiquidityMiningEcosystem.mineralDistributor },
      'distributor',
      'ownerSetHandler',
      ['0xdF86dFdf493bCD2b838a44726A1E58f66869ccBe', true],
    ),
  );
  return {
    core,
    upload: {
      transactions,
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
