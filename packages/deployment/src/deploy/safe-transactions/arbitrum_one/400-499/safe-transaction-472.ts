import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
  prettyPrintEncodeInsertChainlinkOracleV3,
} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

const HARVEST_MULTISIG = '0xF066789028fE31D4f53B69B81b328B8218Cc0641';

/**
 * This script encodes the following transactions:
 * - Upgrades the GLV oracle to Chainlink
 * - Whitelists Harvest Multisig as a sender for Minerals
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    ...(await prettyPrintEncodeInsertChainlinkOracleV3(
      core,
      core.glvEcosystem.live.glvBtc.factory,
      undefined,
      undefined,
      undefined,
      { ignoreDescription: true },
    )),
    ...(await prettyPrintEncodeInsertChainlinkOracleV3(
      core,
      core.glvEcosystem.live.glvEth.factory,
      undefined,
      undefined,
      undefined,
      { ignoreDescription: true },
    )),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.liquidityMiningEcosystem.minerals,
      'mineralToken',
      'ownerSetIsTransferAgent',
      [HARVEST_MULTISIG, true],
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
      const glvBtcPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.dGlvBtc);
      const glvEthPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.dGlvEth);

      console.log('GLV-BTC price:', glvBtcPrice.value.toString());
      console.log('GLV-ETH price:', glvEthPrice.value.toString());

      assertHardhatInvariant(
        await core.liquidityMiningEcosystem.minerals.mineralToken.isTransferAgent(HARVEST_MULTISIG),
        'Harvest Multisig not a transfer agent',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
