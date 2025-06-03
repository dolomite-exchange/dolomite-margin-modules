import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { expectProtocolBalance } from 'packages/base/test/utils/assertions';
import {
  IInfraredVault__factory,
  InfraredBGTMetaVaultWithOwnerStake__factory,
  POLIsolationModeVaultFactory__factory,
} from 'packages/berachain/src/types';
import { RewardVaultType } from 'packages/berachain/test/berachain-ecosystem-utils';
import { POLBalanceMapping } from 'packages/berachain/test/POLBalanceMapping';
import Deployments from 'packages/deployment/src/deploy/deployments.json';
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

  // Confirm data from pol mapping
  let totalSupplySum = BigNumber.from(0);
  for (const user of Object.keys(POLBalanceMapping)) {
    const userInfo = POLBalanceMapping[user];
    const vault = await polFactory.getVaultByAccount(user);
    expect(await polRegistry.getMetaVaultByAccount(user)).to.eq(userInfo.metaVault);

    await expectProtocolBalance(core, vault, userInfo.accountNumber, 39, userInfo.polAmount);
    expect(await core.dolomiteTokens.rUsd.balanceOf(userInfo.metaVault)).to.eq(userInfo.drUsdMetaVaultBalance);
    expect(await rusdInfraredVault.balanceOf(userInfo.metaVault)).to.eq(userInfo.metaVaultStakedBalance);

    totalSupplySum = totalSupplySum.add(userInfo.polAmount);
  }
  expect(totalSupplySum.eq(await polFactory.totalSupply())).to.be.true;

  // Remove DepositWithdrawalProxy as allowed token converter, set new vault and metaVault
  const transactions: EncodedTransaction[] = [];
  for (const user of Object.keys(POLBalanceMapping)) {
    const userInfo = POLBalanceMapping[user];
    const metaVault = InfraredBGTMetaVaultWithOwnerStake__factory.connect(
      await polRegistry.getMetaVaultByAccount(user),
      core.hhUser1,
    );

    if (
      userInfo.drUsdMetaVaultBalance.eq(ZERO_BI) &&
      userInfo.metaVaultStakedBalance.eq(ZERO_BI) &&
      userInfo.polAmount.gt(ZERO_BI)
    ) {
      // Only transfer drUSD when the user has zero balance but a non-zero POL amount
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          core.dolomiteTokens,
          'rUsd',
          'transfer',
          [metaVault.address, userInfo.polAmount],
          { skipWrappingCalldataInSubmitTransaction: true },
        ),
      );
    }
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
      for (const user of Object.keys(POLBalanceMapping)) {
        const userInfo = POLBalanceMapping[user];
        if (userInfo.drUsdMetaVaultBalance.eq(ZERO_BI) && userInfo.metaVaultStakedBalance.eq(ZERO_BI)) {
          expect(await core.dolomiteTokens.rUsd.balanceOf(userInfo.metaVault)).to.eq(userInfo.polAmount);
        }
      }
    },
  };
}

doDryRunAndCheckDeployment(main);
