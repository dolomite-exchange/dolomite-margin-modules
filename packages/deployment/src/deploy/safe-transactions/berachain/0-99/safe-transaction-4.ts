import { parseEther } from 'ethers/lib/utils';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { EncodedTransaction } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkMarket, encodeSimpleBoycoListing } from '../utils';

const BTC_PRICE_8D = '1050000000000000000000000000000000'; // $105k
const BTC_PRICE_18D = parseEther(`${105_000}`); // $105k
const ETH_PRICE = parseEther(`${3_400}`); // $3,400
const STABLE_COIN_PRICE_6D = '1000000000000000000000000000000';
const STABLE_COIN_PRICE_18D = parseEther(`${1}`);

/**
 * This script encodes the following transactions:
 * - Lists first batch of Boyco markets
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];

  transactions.push(
    ...(await encodeSimpleBoycoListing(core, core.tokens.weth, ETH_PRICE)),
    ...(await encodeSimpleBoycoListing(core, core.tokens.wbera, parseEther(`${5}`))),
    ...(await encodeSimpleBoycoListing(core, core.tokens.usdc, STABLE_COIN_PRICE_6D)),
    ...(await encodeSimpleBoycoListing(core, core.tokens.honey, STABLE_COIN_PRICE_18D)),
    ...(await encodeSimpleBoycoListing(core, core.tokens.wbtc, BTC_PRICE_8D)),
    ...(await encodeSimpleBoycoListing(core, core.tokens.usdt, STABLE_COIN_PRICE_6D)),
    ...(await encodeSimpleBoycoListing(core, core.tokens.lbtc, BTC_PRICE_8D)),
    ...(await encodeSimpleBoycoListing(core, core.tokens.rswEth, ETH_PRICE)),
    ...(await encodeSimpleBoycoListing(core, core.tokens.rUsd, STABLE_COIN_PRICE_18D)),
    ...(await encodeSimpleBoycoListing(core, core.tokens.stonebtc, BTC_PRICE_18D)),
    ...(await encodeSimpleBoycoListing(core, core.tokens.sUsde, STABLE_COIN_PRICE_18D)),
    ...(await encodeSimpleBoycoListing(core, core.tokens.stBtc, BTC_PRICE_18D)),
    ...(await encodeSimpleBoycoListing(core, core.tokens.stone, ETH_PRICE)),
    ...(await encodeSimpleBoycoListing(core, core.tokens.uniBtc, BTC_PRICE_8D)),
    ...(await encodeSimpleBoycoListing(core, core.tokens.usde, STABLE_COIN_PRICE_18D)),
    ...(await encodeSimpleBoycoListing(core, core.tokens.ylBtcLst, BTC_PRICE_8D)),
    ...(await encodeSimpleBoycoListing(core, core.tokens.ylPumpBtc, BTC_PRICE_8D)),
    ...(await encodeSimpleBoycoListing(core, core.tokens.ylStEth, ETH_PRICE)),
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
      await checkMarket(core, core.marketIds.weth, core.tokens.weth);
      await checkMarket(core, core.marketIds.wbera, core.tokens.wbera);
      await checkMarket(core, core.marketIds.usdc, core.tokens.usdc);
      await checkMarket(core, core.marketIds.honey, core.tokens.honey);
      await checkMarket(core, core.marketIds.wbtc, core.tokens.wbtc);
      await checkMarket(core, core.marketIds.usdt, core.tokens.usdt);
      await checkMarket(core, core.marketIds.lbtc, core.tokens.lbtc);
      await checkMarket(core, core.marketIds.rswEth, core.tokens.rswEth);
      await checkMarket(core, core.marketIds.rUsd, core.tokens.rUsd);
      await checkMarket(core, core.marketIds.sbtc, core.tokens.stonebtc);
      await checkMarket(core, core.marketIds.sUsde, core.tokens.sUsde);
      await checkMarket(core, core.marketIds.stBtc, core.tokens.stBtc);
      await checkMarket(core, core.marketIds.stone, core.tokens.stone);
      await checkMarket(core, core.marketIds.uniBtc, core.tokens.uniBtc);
      await checkMarket(core, core.marketIds.usde, core.tokens.usde);
      await checkMarket(core, core.marketIds.ylBtcLst, core.tokens.ylBtcLst);
      await checkMarket(core, core.marketIds.ylPumpBtc, core.tokens.ylPumpBtc);
      await checkMarket(core, core.marketIds.ylStEth, core.tokens.ylStEth);
    },
  };
}

doDryRunAndCheckDeployment(main);
