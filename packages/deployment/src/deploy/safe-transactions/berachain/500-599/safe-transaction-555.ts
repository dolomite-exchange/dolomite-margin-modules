import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { deployContractAndSave } from 'packages/deployment/src/utils/deploy-utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';

/**
 * This script encodes the following transactions:
 * - Remove pushed tokens from VeExternalVester and send to the DAO
 * - Upgrade the vester to V2
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const vesterV2Address = await deployContractAndSave(
    'VeExternalVesterImplementationV2',
    [
      core.dolomiteMargin.address,
      core.dolomiteRegistry.address,
      await core.tokenomics.veExternalVester.PAIR_TOKEN(), // dolo
      await core.tokenomics.veExternalVester.PAIR_MARKET_ID(),
      await core.tokenomics.veExternalVester.PAYMENT_TOKEN(), // usdc
      await core.tokenomics.veExternalVester.PAYMENT_MARKET_ID(),
      await core.tokenomics.veExternalVester.REWARD_TOKEN(), // dolo
      await core.tokenomics.veExternalVester.REWARD_MARKET_ID(),
    ],
    'VeExternalVesterImplementationV7',
  )

  const transactions: EncodedTransaction[] = [];
  const preBal = await core.tokens.dolo.balanceOf(core.daoAddress!);
  const pushedTokens = await core.tokenomics.veExternalVester.pushedTokens();

  // Owner withdraws pushed tokens from the vester and sends to the DAO
  // Upgrade the vester to V2
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.tokenomics,
      'veExternalVester',
      'ownerWithdrawRewardToken',
      [core.daoAddress!, pushedTokens, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.tokenomics,
      'veExternalVesterProxy',
      'upgradeTo',
      [vesterV2Address],
    ),
    // @follow-up I am not sure how to encode a transaction for the DAO to approve DOLO to vester
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
      assertHardhatInvariant(
        (await core.tokenomics.veExternalVester.pushedTokens()).eq(ZERO_BI),
        "Pushed tokens should be 0"
      );
      assertHardhatInvariant(
        (await core.tokenomics.veExternalVester.promisedTokens()).eq(await core.tokens.dolo.balanceOf(core.tokenomics.veExternalVester.address)),
        "Promised tokens should be equal to dolo.balanceOf(vester)"
      );
      assertHardhatInvariant(
        (await core.tokens.dolo.balanceOf(core.daoAddress!)).eq(preBal.add(pushedTokens)),
        "Invalid DOLO balance for DAO"
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
