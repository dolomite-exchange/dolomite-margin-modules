import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  getPendlePtIsolationModeUnwrapperTraderV2ConstructorParams,
  getPendlePtIsolationModeWrapperTraderV2ConstructorParams,
} from 'packages/pendle/src/pendle-constructors';
import { deployContractAndSave, prettyPrintEncodedDataWithTypeSafety } from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

const OLD_PT_WE_ETH_SEP_2024_UNWRAPPER = '0x19F44150f7c6de1879518673d00ab7839700B909';
const OLD_PT_WE_ETH_SEP_2024_WRAPPER = '0x3249492D3138699238Dc69d55137bacE9da489B1';

/**
 * This script encodes the following transactions:
 * - Disables the old unwrapper / wrapper on the PT-eETH (Sep 2024) factory
 * - Deploys and enables the new unwrapper / wrapper on the PT-eETH (Sep 2024) factory
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions = [];

  const factory = core.pendleEcosystem.weEthSep2024.dPtWeEthSep2024;
  const unwrapperAddress = await deployContractAndSave(
    'PendlePtIsolationModeUnwrapperTraderV3',
    getPendlePtIsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem.weEthSep2024.pendleRegistry,
      core.tokens.weEth,
      factory,
    ),
    'PendlePtWeETHSep2024IsolationModeUnwrapperTraderV3',
  );
  const wrapperAddress = await deployContractAndSave(
    'PendlePtIsolationModeWrapperTraderV3',
    getPendlePtIsolationModeWrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem.weEthSep2024.pendleRegistry,
      core.tokens.weEth,
      factory,
    ),
    'PendlePtWeETHSep2024IsolationModeWrapperTraderV3',
  );

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [OLD_PT_WE_ETH_SEP_2024_UNWRAPPER, false],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [OLD_PT_WE_ETH_SEP_2024_WRAPPER, false],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [unwrapperAddress, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [wrapperAddress, true],
    ),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    invariants: async () => {
      assertHardhatInvariant(
        !(await factory.isTokenConverterTrusted(OLD_PT_WE_ETH_SEP_2024_UNWRAPPER)),
        'Old unwrapper is still trusted',
      );
      assertHardhatInvariant(
        !(await factory.isTokenConverterTrusted(OLD_PT_WE_ETH_SEP_2024_WRAPPER)),
        'Old wrapper is still trusted',
      );

      assertHardhatInvariant(
        await factory.isTokenConverterTrusted(unwrapperAddress),
        'New unwrapper is not trusted',
      );
      assertHardhatInvariant(
        await factory.isTokenConverterTrusted(wrapperAddress),
        'New wrapper is not trusted',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
