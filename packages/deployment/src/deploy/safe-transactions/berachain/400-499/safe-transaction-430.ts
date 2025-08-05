import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { expectProtocolBalance } from 'packages/base/test/utils/assertions';
import {
  IInfraredVault__factory,
  InfraredBGTMetaVaultWithOwnerStake__factory,
  POLIsolationModeVaultFactory__factory,
} from 'packages/berachain/src/types';
import { RewardVaultType } from 'packages/berachain/test/berachain-ecosystem-utils';
import { POLBalanceMapping } from 'packages/berachain/test/POLBalanceMapping';
import Deployments from 'packages/deployment/src/deploy/deployments.json';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Fix pol-rUsd accounts, deploy new vault
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const polRegistry = core.berachainRewardsEcosystem.live.registry;
  const polFactory = POLIsolationModeVaultFactory__factory.connect(
    Deployments.POLrUsdIsolationModeVaultFactory[network].address,
    core.hhUser1,
  );
  const rusdInfraredVault = IInfraredVault__factory.connect(
    await polRegistry.rewardVault(core.dolomiteTokens.rUsd.address, RewardVaultType.Infrared),
    core.hhUser1,
  );
  const currentMetaVaultImplementation = await polRegistry.metaVaultImplementation();

  // Confirm data from pol mapping
  for (const user of Object.keys(POLBalanceMapping)) {
    const userInfo = POLBalanceMapping[user];
    const vault = await polFactory.getVaultByAccount(user);
    expect(await polRegistry.getMetaVaultByAccount(user)).to.eq(userInfo.metaVault);

    await expectProtocolBalance(core, vault, userInfo.accountNumber, 39, userInfo.polAmount);
    if (userInfo.metaVaultStakedBalance.eq(ZERO_BI)) {
      expect(await core.dolomiteTokens.rUsd.balanceOf(userInfo.metaVault)).to.eq(userInfo.polAmount);
    }
    expect(await rusdInfraredVault.balanceOf(userInfo.metaVault)).to.eq(userInfo.metaVaultStakedBalance);
  }

  const polVaultImplementationV2Address = await deployContractAndSave(
    'POLIsolationModeTokenVaultV1',
    [],
    'POLIsolationModeVaultImplementationV2',
    core.libraries.tokenVaultActionsImpl,
  );
  const infraredBgtMetaVaultWithOwnerStakeAddress = await deployContractAndSave(
    'InfraredBGTMetaVaultWithOwnerStake',
    [core.dolomiteMargin.address],
    'InfraredBGTMetaVaultWithOwnerStakeImplementationV1',
  );

  const transactions: EncodedTransaction[] = [
    // Remove DepositWithdrawalProxy as allowed token converter
    await prettyPrintEncodedDataWithTypeSafety(core, { polFactory }, 'polFactory', 'ownerSetIsTokenConverterTrusted', [
      core.depositWithdrawalRouter.address,
      false,
    ]),
    // Set the new token vault
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.berachainRewardsEcosystem.live,
      'registry',
      'ownerSetPolTokenVault',
      [polVaultImplementationV2Address],
    ),
    // Set the new meta vault
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.berachainRewardsEcosystem.live,
      'registry',
      'ownerSetMetaVaultImplementation',
      [infraredBgtMetaVaultWithOwnerStakeAddress],
    ),
  ];

  // Stake each user's POL balance
  for (const user of Object.keys(POLBalanceMapping)) {
    const userInfo = POLBalanceMapping[user];
    const metaVault = InfraredBGTMetaVaultWithOwnerStake__factory.connect(
      await polRegistry.getMetaVaultByAccount(user),
      core.hhUser1,
    );

    if (userInfo.drUsdMetaVaultBalance.eq(ZERO_BI) && userInfo.metaVaultStakedBalance.eq(ZERO_BI)) {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(core, { metaVault }, 'metaVault', 'ownerStakeDolomiteToken', [
          core.dolomiteTokens.rUsd.address,
          RewardVaultType.Infrared,
          userInfo.polAmount,
        ]),
      );
    }
  }

  // Set the meta vault implementation back to the original
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.berachainRewardsEcosystem.live,
      'registry',
      'ownerSetMetaVaultImplementation',
      [currentMetaVaultImplementation],
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
    invariants: async () => {
      const registry = core.berachainRewardsEcosystem.live.registry;
      assertHardhatInvariant(
        (await registry.metaVaultImplementation()) === currentMetaVaultImplementation,
        'Invalid meta vault implementation',
      );
      assertHardhatInvariant(
        (await registry.polTokenVault()) === polVaultImplementationV2Address,
        'Invalid POL token vault implementation',
      );
      assertHardhatInvariant(
        !(await polFactory.isTokenConverterTrusted(core.depositWithdrawalRouter.address)),
        'Router should be disabled',
      );

      for (const user of Object.keys(POLBalanceMapping)) {
        const userInfo = POLBalanceMapping[user];
        expect(await core.dolomiteTokens.rUsd.balanceOf(userInfo.metaVault)).to.eq(ZERO_BI);
        expect(await rusdInfraredVault.balanceOf(userInfo.metaVault)).to.eq(userInfo.polAmount);
      }
    },
  };
}

doDryRunAndCheckDeployment(main);
