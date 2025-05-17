import { parseEther } from 'ethers/lib/utils';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkMarket } from '../../../../utils/invariant-utils';
import { encodeSimpleBoycoListing } from '../utils';

const BTC_PRICE_8D = '1050000000000000000000000000000000'; // $105k
const BTC_PRICE_18D = parseEther(`${105_000}`); // $105k
const ETH_PRICE = parseEther(`${3_400}`); // $3,400
const STABLE_COIN_PRICE_18D = parseEther(`${1}`);

/**
 * This script encodes the following transactions:
 * - Lists second batch of Boyco markets
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];

  transactions.push(
    ...(await encodeSimpleBoycoListing(core, core.tokens.beraEth, ETH_PRICE)),
    ...(await encodeSimpleBoycoListing(core, core.tokens.nect, STABLE_COIN_PRICE_18D)),
    ...(await encodeSimpleBoycoListing(core, core.tokens.pumpBtc, BTC_PRICE_8D)),
    ...(await encodeSimpleBoycoListing(core, core.tokens.rsEth, ETH_PRICE)),
    ...(await encodeSimpleBoycoListing(core, core.tokens.sUsda, STABLE_COIN_PRICE_18D)),
    ...(await encodeSimpleBoycoListing(core, core.tokens.solvBtc, BTC_PRICE_18D)),
    ...(await encodeSimpleBoycoListing(core, core.tokens.xSolvBtc, BTC_PRICE_18D)),
    ...(await encodeSimpleBoycoListing(core, core.tokens.usda, STABLE_COIN_PRICE_18D)),
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
      await checkMarket(core, core.marketIds.beraEth, core.tokens.beraEth);
      await checkMarket(core, core.marketIds.nect, core.tokens.nect);
      await checkMarket(core, core.marketIds.pumpBtc, core.tokens.pumpBtc);
      await checkMarket(core, core.marketIds.rsEth, core.tokens.rsEth);
      await checkMarket(core, core.marketIds.sUsda, core.tokens.sUsda);
      await checkMarket(core, core.marketIds.solvBtc, core.tokens.solvBtc);
      await checkMarket(core, core.marketIds.xSolvBtc, core.tokens.xSolvBtc);
      await checkMarket(core, core.marketIds.usda, core.tokens.usda);
    },
  };
}

doDryRunAndCheckDeployment(main);
