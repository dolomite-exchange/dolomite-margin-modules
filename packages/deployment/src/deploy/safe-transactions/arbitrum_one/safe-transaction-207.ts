import {
  getIsolationModeFreezableLiquidatorProxyConstructorParams,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { impersonate } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  getGmxV2RegistryConstructorParams,
  GMX_V2_CALLBACK_GAS_LIMIT,
} from '@dolomite-exchange/modules-gmx-v2/src/gmx-v2-constructors';
import { GmxV2Registry__factory } from '@dolomite-exchange/modules-gmx-v2/src/types';
import { BigNumberish } from 'ethers';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Deploys new unwrapper / wrapper contracts for PT-wstETH (Jun 2024)
 * - Deploys new unwrapper / wrapper contracts for PT-wstETH (Jun 2025)
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const gmxV2RegistryImplementationAddress = await deployContractAndSave(
    'GmxV2Registry',
    [],
    'GmxV2RegistryImplementationV1',
  );
  const gmxV2RegistryImplementation = GmxV2Registry__factory.connect(gmxV2RegistryImplementationAddress, core.hhUser1);

  const gmxV2RegistryProxyAddress = await deployContractAndSave(
    'RegistryProxy',
    await getGmxV2RegistryConstructorParams(core, gmxV2RegistryImplementation, GMX_V2_CALLBACK_GAS_LIMIT),
    'GmxV2RegistryProxy',
  );

  const gmxV2Library = await deployContractAndSave(
    'GmxV2Library',
    [],
    'GmxV2LibraryV1',
  );
  const tokenVaultAddress = await deployContractAndSave(
    'GmxV2IsolationModeTokenVaultV1',
    [core.tokens.weth.address],
    'GmxV2IsolationModeTokenVaultV1',
    { GmxV2Library: gmxV2Library },
  );

  const liquidatorProxyAddress = await deployContractAndSave(
    'IsolationModeFreezableLiquidatorProxy',
    getIsolationModeFreezableLiquidatorProxyConstructorParams(core),
    'IsolationModeFreezableLiquidatorProxyV1',
  );

  const marketId = await core.dolomiteMargin.getNumMarkets();
  const gmMarketIds: BigNumberish[] = [];
  for (let i = 0; i < 4; i++) {
    gmMarketIds.push(marketId.add(i));
  }

  const globalOperators = [liquidatorProxyAddress];

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [liquidatorProxyAddress, true],
    ),
    ...await Promise.all(
      gmMarketIds.map(marketId =>
        prettyPrintEncodedDataWithTypeSafety(
          core,
          core,
          'liquidatorAssetRegistry',
          'ownerAddLiquidatorToAssetWhitelist',
          [marketId, liquidatorProxyAddress],
        ),
      ),
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
      const OLD_DURATION = '';
      const NEW_DURATION = 86_400 * 7 * 40; // 40 weeks
      const nftId = '';
      assertHardhatInvariant(
        (await core.liquidityMiningEcosystem.oArbVesterV2.vestingPositions(nftId)).duration.eq(OLD_DURATION),
        'Invalid duration before',
      );

      const signer = await impersonate('');
      await core.liquidityMiningEcosystem.oArbVesterV2.connect(signer)
        .extendDurationForPosition(nftId, NEW_DURATION);

      assertHardhatInvariant(
        (await core.liquidityMiningEcosystem.oArbVesterV2.vestingPositions(nftId)).duration.eq(NEW_DURATION),
        'Invalid duration after',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
