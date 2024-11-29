import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { getVesterImplementationConstructorParams } from 'packages/liquidity-mining/src/liquidity-mining-constructors';
import { BigNumber } from 'ethers';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { deployContractAndSave, prettyPrintEncodedDataWithTypeSafety } from '../../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../../utils/dry-run-utils';
import getScriptName from '../../../../../utils/get-script-name';

const LTIP_MULTISIG = '0x544cBe6698E2e3b676C76097305bBa588dEfB13A';

/**
 * This script encodes the following transactions:
 * - Updates the oARB vester implementation to the latest version
 * - Disables the oARB vester and withdraws the remaining ARB tokens
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });
  const vesterAddress = await deployContractAndSave(
    'VesterImplementationV2',
    getVesterImplementationConstructorParams(core, core.tokens.arb),
    'VesterImplementationV4',
    core.liquidityMiningEcosystem.oARB.library,
  );

  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.liquidityMiningEcosystem.oARB,
      'oArbVesterProxy',
      'upgradeTo',
      [vesterAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.liquidityMiningEcosystem.oARB,
      'oArbVesterV2',
      'ownerSetIsVestingActive',
      [false],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.liquidityMiningEcosystem.oARB,
      'oArbVesterV2',
      'ownerWithdrawToken',
      [LTIP_MULTISIG, BigNumber.from('64339433454045315201538'), false],
    ),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
    },
    invariants: async () => {
      assertHardhatInvariant(
        !(await core.liquidityMiningEcosystem.oARB.oArbVester.isVestingActive()),
        'Vester should be inactive!',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
