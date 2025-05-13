import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Sets the GLV tokens to default GMX markets for deposits and withdrawals
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const glvRegistry = core.glvEcosystem.live.registry;

  const glvBtc = core.glvEcosystem.glvTokens.wbtcUsdc.glvToken;
  const glvEth = core.glvEcosystem.glvTokens.wethUsdc.glvToken;

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { glvRegistry: glvRegistry },
      'glvRegistry',
      'ownerSetGlvTokenToGmMarketForDeposit',
      [glvBtc.address, core.gmxV2Ecosystem.gmTokens.btcUsd.marketToken.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { glvRegistry: glvRegistry },
      'glvRegistry',
      'ownerSetGlvTokenToGmMarketForWithdrawal',
      [glvBtc.address, core.gmxV2Ecosystem.gmTokens.btcUsd.marketToken.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { glvRegistry: glvRegistry },
      'glvRegistry',
      'ownerSetGlvTokenToGmMarketForDeposit',
      [glvEth.address, core.gmxV2Ecosystem.gmTokens.ethUsd.marketToken.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { glvRegistry: glvRegistry },
      'glvRegistry',
      'ownerSetGlvTokenToGmMarketForWithdrawal',
      [glvEth.address, core.gmxV2Ecosystem.gmTokens.ethUsd.marketToken.address],
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
        (await glvRegistry.glvTokenToGmMarketForDeposit(glvBtc.address)) === core.gmxV2Ecosystem.gmTokens.btcUsd.marketToken.address,
        'Invalid gm market for glv btc',
      );
      assertHardhatInvariant(
        (await glvRegistry.glvTokenToGmMarketForWithdrawal(glvBtc.address)) === core.gmxV2Ecosystem.gmTokens.btcUsd.marketToken.address,
        'Invalid gm market for glv btc',
      );
      assertHardhatInvariant(
        (await glvRegistry.glvTokenToGmMarketForDeposit(glvEth.address)) === core.gmxV2Ecosystem.gmTokens.ethUsd.marketToken.address,
        'Invalid gm market for glv eth',
      );
      assertHardhatInvariant(
        (await glvRegistry.glvTokenToGmMarketForWithdrawal(glvEth.address)) === core.gmxV2Ecosystem.gmTokens.ethUsd.marketToken.address,
        'Invalid gm market for glv eth',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
