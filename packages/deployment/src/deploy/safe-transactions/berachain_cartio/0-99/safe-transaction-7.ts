import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { deployDolomiteErc4626Token } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeSetGlobalOperator } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Creates dTokens for each listed market
 * - Sets each dToken as a global operator
 */
async function main(): Promise<DryRunOutput<Network.BerachainCartio>> {
  const network = await getAndCheckSpecificNetwork(Network.BerachainCartio);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const beraETH = await deployDolomiteErc4626Token(core, 'BeraEth', core.marketIds.beraETH);
  const nect = await deployDolomiteErc4626Token(core, 'Nect', core.marketIds.nect);
  const pumpBtc = await deployDolomiteErc4626Token(core, 'PumpBtc', core.marketIds.pumpBtc);
  const stBtc = await deployDolomiteErc4626Token(core, 'StBtc', core.marketIds.stBtc);
  const stone = await deployDolomiteErc4626Token(core, 'Stone', core.marketIds.stone);
  const ylBtcLst = await deployDolomiteErc4626Token(core, 'YlBtc', core.marketIds.ylBtcLst);
  const ylFbtc = await deployDolomiteErc4626Token(core, 'YlFbtc', core.marketIds.ylFbtc);
  const ylPumpBtc = await deployDolomiteErc4626Token(core, 'YlPumpBtc', core.marketIds.ylPumpBtc);
  const ylStEth = await deployDolomiteErc4626Token(core, 'YlStEth', core.marketIds.ylStEth);
  const ylUniBtc = await deployDolomiteErc4626Token(core, 'YlUniBtc', core.marketIds.ylUniBtc);

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await encodeSetGlobalOperator(core, beraETH, true),
    await encodeSetGlobalOperator(core, nect, true),
    await encodeSetGlobalOperator(core, pumpBtc, true),
    await encodeSetGlobalOperator(core, stBtc, true),
    await encodeSetGlobalOperator(core, stone, true),
    await encodeSetGlobalOperator(core, ylBtcLst, true),
    await encodeSetGlobalOperator(core, ylFbtc, true),
    await encodeSetGlobalOperator(core, ylPumpBtc, true),
    await encodeSetGlobalOperator(core, ylStEth, true),
    await encodeSetGlobalOperator(core, ylUniBtc, true),
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
        await core.dolomiteMargin.getIsGlobalOperator(beraETH.address),
        'beraETH is not a global operator',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(nect.address),
        'nect is not a global operator',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(pumpBtc.address),
        'pumpBtc is not a global operator',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(stBtc.address),
        'stBtc is not a global operator',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(stone.address),
        'stone is not a global operator',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(ylBtcLst.address),
        'ylBtcLst is not a global operator',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(ylFbtc.address),
        'ylFbtc is not a global operator',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(ylPumpBtc.address),
        'ylPumpBtc is not a global operator',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(ylStEth.address),
        'ylStEth is not a global operator',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(ylUniBtc.address),
        'ylUniBtc is not a global operator',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
