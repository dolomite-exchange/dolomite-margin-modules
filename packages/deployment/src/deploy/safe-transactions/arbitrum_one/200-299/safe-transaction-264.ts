import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  getPendlePtIsolationModeUnwrapperTraderV3ConstructorParams,
  getPendlePtIsolationModeWrapperTraderV3ConstructorParams,
} from '@dolomite-exchange/modules-pendle/src/pendle-constructors';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

const oldWrapper = '0x04Cd942E5BAb40774d3d1Bd33FA90b22691D7a12';
const oldUnwrapper = '0x29Be234D34eA0538CAB09Eb2575a3037D5fa413d';

/**
 * This script encodes the following transactions:
 * - Deploys PendleV3Router unwrapper and wrapper for the following markets:
 *      GLPMar2024
 * - Disables the old wrapper and unwrappers for this market
 * - Enables the new wrapper and unwrappers for this market
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions = [];
  const factory = core.pendleEcosystem.glpMar2024.dPtGlpMar2024 as any;
  const pendleRegistry = core.pendleEcosystem.glpMar2024.pendleRegistry;
  const underlyingToken = core.tokens.sGlp;

  const newUnwrapper = await deployContractAndSave(
    'PendlePtIsolationModeUnwrapperTraderV3',
    getPendlePtIsolationModeUnwrapperTraderV3ConstructorParams(
      core,
      pendleRegistry,
      underlyingToken,
      factory,
    ),
    'PendlePtGLPMar2024IsolationModeUnwrapperTraderV5',
  );

  const newWrapper = await deployContractAndSave(
    'PendlePtIsolationModeWrapperTraderV3',
    getPendlePtIsolationModeWrapperTraderV3ConstructorParams(
      core,
      pendleRegistry,
      underlyingToken,
      factory,
    ),
    'PendlePtGLPMar2024IsolationModeWrapperTraderV5',
  );

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [oldWrapper, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [oldUnwrapper, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [newWrapper, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [newUnwrapper, true],
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
        await factory.isTokenConverterTrusted(newWrapper),
        'New wrapper is not trusted',
      );
      assertHardhatInvariant(
        await factory.isTokenConverterTrusted(newUnwrapper),
        'New unwrapper is not trusted',
      );
      assertHardhatInvariant(
        !(await factory.isTokenConverterTrusted(oldWrapper)),
        'Old wrapper is trusted',
      );
      assertHardhatInvariant(
        !(await factory.isTokenConverterTrusted(oldUnwrapper)),
        'Old unwrapper is trusted',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
