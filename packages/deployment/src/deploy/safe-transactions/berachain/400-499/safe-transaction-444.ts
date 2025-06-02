import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol, setupRUsdBalance } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import { AdminPauseMarket__factory } from '@dolomite-exchange/modules-admin/src/types';
import { POLBalanceMapping } from 'packages/berachain/test/POLBalanceMapping';
import { expect } from 'chai';
import Deployments from 'packages/deployment/src/deploy/deployments.json';
import { IInfraredVault__factory, InfraredBGTMetaVaultWithOwnerStake__factory, POLIsolationModeTokenVaultV1__factory, POLIsolationModeVaultFactory__factory } from 'packages/berachain/src/types';
import { expectProtocolBalance } from 'packages/base/test/utils/assertions';
import { RewardVaultType } from 'packages/berachain/test/berachain-ecosystem-utils';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';

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
  // @todo REMOVE
  await setupRUsdBalance(core, core.gnosisSafe, parseEther('2000000'), core.dolomiteMargin);

  const polRegistry = core.berachainRewardsEcosystem.live.registry;
  const polFactory = POLIsolationModeVaultFactory__factory.connect(
    Deployments.POLrUsdIsolationModeVaultFactory[network].address,
    core.hhUser1
  );
  const rusdInfraredVault = IInfraredVault__factory.connect(
    await polRegistry.rewardVault(core.dolomiteTokens.rUsd.address, RewardVaultType.Infrared),
    core.hhUser1,
  );
  const currentMetavaultImplementation = await polRegistry.metaVaultImplementation();

  // Confirm data from pol mapping
  let totalSupplySum = BigNumber.from(0);
  for (const user of Object.keys(POLBalanceMapping)) {
    const userInfo = POLBalanceMapping[user];
    const vault = await polFactory.getVaultByAccount(user);
    expect(await polRegistry.getMetaVaultByAccount(user)).to.eq(userInfo.metavault);

      await expectProtocolBalance(core, vault, userInfo.accountNumber, 39, userInfo.polAmount);
      expect(await core.dolomiteTokens.rUsd.balanceOf(userInfo.metavault)).to.eq(userInfo.drUsdMetavaultBalance);
      expect(await rusdInfraredVault.balanceOf(userInfo.metavault)).to.eq(userInfo.metavaultStakedBalance);

      totalSupplySum = totalSupplySum.add(userInfo.polAmount);
  }
  expect(totalSupplySum.eq(await polFactory.totalSupply())).to.be.true;

  // Deploy InfraredBGTMetaVaultWithOwnerStake and new POLIsolationModeVaultV1
  const polVaultImplementationAddress = await deployContractAndSave(
    'POLIsolationModeTokenVaultV1',
    [],
    'POLIsolationModeVaultImplementationV2',
    core.libraries.tokenVaultActionsImpl
  );
  const infraredBgtMetaVaultWithOwnerStakeAddress = await deployContractAndSave(
    'InfraredBGTMetaVaultWithOwnerStake',
    [core.dolomiteMargin.address],
    'InfraredBGTMetaVaultWithOwnerStakeImplementationV1',
  );

  // Remove DepositWithdrawalProxy as allowed token converter, set new vault and metavault
  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { polFactory },
      'polFactory',
      'ownerSetIsTokenConverterTrusted',
      [core.depositWithdrawalRouter.address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.berachainRewardsEcosystem.live,
      'registry',
      'ownerSetPolTokenVault',
      [polVaultImplementationAddress],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.berachainRewardsEcosystem.live,
      'registry',
      'ownerSetMetaVaultImplementation',
      [infraredBgtMetaVaultWithOwnerStakeAddress],
    ),
  );

  // Loop through each user and transfer drUsd and stake
  for (const user of Object.keys(POLBalanceMapping)) {
    const userInfo = POLBalanceMapping[user];
    const vault = POLIsolationModeTokenVaultV1__factory.connect(
      await polFactory.getVaultByAccount(user),
      core.hhUser1
    );
    const metavault = InfraredBGTMetaVaultWithOwnerStake__factory.connect(
      await polRegistry.getMetaVaultByAccount(user),
      core.hhUser1
    );

    if (userInfo.drUsdMetavaultBalance.eq(ZERO_BI) && userInfo.metavaultStakedBalance.eq(ZERO_BI)) {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          core.dolomiteTokens,
          'rUsd',
          'transfer',
          [metavault.address, userInfo.polAmount],
          { skipWrappingCalldataInSubmitTransaction: true }
        ),
      );
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          { metavault },
          'metavault',
          'ownerStakeDolomiteToken',
          [core.dolomiteTokens.rUsd.address, RewardVaultType.Infrared, userInfo.polAmount],
        ),
      );
    }
  }

  // Unpause market and set metavault implementation back to original
  const adminPause = AdminPauseMarket__factory.connect(
    Deployments.AdminPauseMarketV1[network].address,
    core.hhUser1
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { adminPause },
      'adminPause',
      'unpauseMarket',
      [await core.dolomiteMargin.getMarketIdByTokenAddress(polFactory.address), core.oracleAggregatorV2.address],
      { skipWrappingCalldataInSubmitTransaction: true }
    )
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.berachainRewardsEcosystem.live,
      'registry',
      'ownerSetMetaVaultImplementation',
      [currentMetavaultImplementation],
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
