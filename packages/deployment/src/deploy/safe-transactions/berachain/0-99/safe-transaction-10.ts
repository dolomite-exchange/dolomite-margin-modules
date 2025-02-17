import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  deployDolomiteErc4626Token,
  deployDolomiteErc4626WithPayableToken,

} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeSetGlobalOperator } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkIsGlobalOperator } from '../../../../utils/invariant-utils';

const IS_GLOBAL_OPERATOR = true;

/**
 * This script encodes the following transactions:
 * - Creates dToken markets for each listed asset for Boyco
 * - Sets each dToken as a global operator
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const weth = await deployDolomiteErc4626Token(core, 'Weth', core.marketIds.weth);
  const wbera = await deployDolomiteErc4626WithPayableToken(core, 'WBera', core.marketIds.wbera);
  const usdc = await deployDolomiteErc4626Token(core, 'Usdc', core.marketIds.usdc);
  const honey = await deployDolomiteErc4626Token(core, 'Honey', core.marketIds.honey);
  const wbtc = await deployDolomiteErc4626Token(core, 'Wbtc', core.marketIds.wbtc);
  const usdt = await deployDolomiteErc4626Token(core, 'Usdt', core.marketIds.usdt);
  const lbtc = await deployDolomiteErc4626Token(core, 'Lbtc', core.marketIds.lbtc);
  const rswEth = await deployDolomiteErc4626Token(core, 'RswEth', core.marketIds.rswEth);
  const rUsd = await deployDolomiteErc4626Token(core, 'RUsd', core.marketIds.rUsd);
  const sbtc = await deployDolomiteErc4626Token(core, 'Sbtc', core.marketIds.sbtc);
  const sUsde = await deployDolomiteErc4626Token(core, 'SUsde', core.marketIds.sUsde);
  const stBtc = await deployDolomiteErc4626Token(core, 'StBtc', core.marketIds.stBtc);
  const stone = await deployDolomiteErc4626Token(core, 'Stone', core.marketIds.stone);
  const uniBtc = await deployDolomiteErc4626Token(core, 'UniBtc', core.marketIds.uniBtc);
  const usde = await deployDolomiteErc4626Token(core, 'Usde', core.marketIds.usde);
  const ylBtcLst = await deployDolomiteErc4626Token(core, 'YlBtcLst', core.marketIds.ylBtcLst);
  const ylPumpBtc = await deployDolomiteErc4626Token(core, 'YlPumpBtc', core.marketIds.ylPumpBtc);
  const ylStEth = await deployDolomiteErc4626Token(core, 'YlStEth', core.marketIds.ylStEth);
  const beraEth = await deployDolomiteErc4626Token(core, 'BeraEth', core.marketIds.beraEth);
  const nect = await deployDolomiteErc4626Token(core, 'Nect', core.marketIds.nect);
  const pumpBtc = await deployDolomiteErc4626Token(core, 'PumpBtc', core.marketIds.pumpBtc);
  const rsEth = await deployDolomiteErc4626Token(core, 'RsEth', core.marketIds.rsEth);
  const sUsda = await deployDolomiteErc4626Token(core, 'SUsda', core.marketIds.sUsda);
  const solvBtc = await deployDolomiteErc4626Token(core, 'SolvBtc', core.marketIds.solvBtc);
  const solvBtcBbn = await deployDolomiteErc4626Token(core, 'SolvBtcBbn', core.marketIds.solvBtcBbn);
  const usda = await deployDolomiteErc4626Token(core, 'Usda', core.marketIds.usda);
  const usd0 = await deployDolomiteErc4626Token(core, 'Usd0', core.marketIds.usd0);
  const usd0pp = await deployDolomiteErc4626Token(core, 'Usd0pp', core.marketIds.usd0pp);

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await encodeSetGlobalOperator(core, weth, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, wbera, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, usdc, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, honey, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, wbtc, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, usdt, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, lbtc, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, rswEth, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, rUsd, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, sbtc, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, sUsde, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, stBtc, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, stone, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, uniBtc, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, usde, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, ylBtcLst, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, ylPumpBtc, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, ylStEth, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, beraEth, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, nect, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, pumpBtc, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, rsEth, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, sUsda, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, solvBtc, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, solvBtcBbn, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, usda, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, usd0, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, usd0pp, IS_GLOBAL_OPERATOR),
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
      await checkIsGlobalOperator(core, weth);
      await checkIsGlobalOperator(core, wbera);
      await checkIsGlobalOperator(core, usdc);
      await checkIsGlobalOperator(core, honey);
      await checkIsGlobalOperator(core, wbtc);
      await checkIsGlobalOperator(core, usdt);
      await checkIsGlobalOperator(core, lbtc);
      await checkIsGlobalOperator(core, rswEth);
      await checkIsGlobalOperator(core, rUsd);
      await checkIsGlobalOperator(core, sbtc);
      await checkIsGlobalOperator(core, sUsde);
      await checkIsGlobalOperator(core, stBtc);
      await checkIsGlobalOperator(core, stone);
      await checkIsGlobalOperator(core, uniBtc);
      await checkIsGlobalOperator(core, usde);
      await checkIsGlobalOperator(core, ylBtcLst);
      await checkIsGlobalOperator(core, ylPumpBtc);
      await checkIsGlobalOperator(core, ylStEth);
      await checkIsGlobalOperator(core, beraEth);
      await checkIsGlobalOperator(core, nect);
      await checkIsGlobalOperator(core, pumpBtc);
      await checkIsGlobalOperator(core, rsEth);
      await checkIsGlobalOperator(core, sUsda);
      await checkIsGlobalOperator(core, solvBtc);
      await checkIsGlobalOperator(core, solvBtcBbn);
      await checkIsGlobalOperator(core, usda);
      await checkIsGlobalOperator(core, usd0);
      await checkIsGlobalOperator(core, usd0pp);
    },
  };
}

doDryRunAndCheckDeployment(main);
