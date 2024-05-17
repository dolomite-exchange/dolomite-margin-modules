import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { impersonate } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  getVesterImplementationConstructorParams
} from '@dolomite-exchange/modules-liquidity-mining/src/liquidity-mining-constructors';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  createFolder,
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
  writeFile,
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
  const core = await setupCoreProtocol({ network, blockNumber: 182_709_000 });

  const VesterImplementationLibForV2Address = await deployContractAndSave(
    'VesterImplementationLibForV2',
    [],
    'VesterImplementationLibForV3',
  );
  const vesterAddress = await deployContractAndSave(
    'VesterImplementationV2',
    getVesterImplementationConstructorParams(core),
    'VesterImplementationV3',
    { VesterImplementationLibForV2: VesterImplementationLibForV2Address },
  );

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.oArbLiquidityMiningEcosystem,
      'oArbVesterProxy',
      'upgradeTo',
      [vesterAddress],
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
      const OLD_DURATION = 86_400 * 7;
      const NEW_DURATION = 86_400 * 7 * 40; // 40 weeks
      const nftId = '1536';
      assertHardhatInvariant(
        (await core.oArbLiquidityMiningEcosystem.oArbVesterV2.vestingPositions(nftId)).duration.eq(OLD_DURATION),
        'Invalid duration before',
      );

      const signer = await impersonate('0x33a288bcf61807582bbee86011f696830fc2a599');
      await core.oArbLiquidityMiningEcosystem.oArbVesterV2.connect(signer)
        .extendDurationForPosition(nftId, NEW_DURATION);

      assertHardhatInvariant(
        (await core.oArbLiquidityMiningEcosystem.oArbVesterV2.vestingPositions(nftId)).duration.eq(NEW_DURATION),
        'Invalid duration after',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
