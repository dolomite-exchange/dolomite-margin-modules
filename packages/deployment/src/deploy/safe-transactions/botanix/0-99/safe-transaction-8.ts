import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { deployDolomiteErc4626Token, deployDolomiteErc4626WithPayableToken } from '../../../../utils/deploy-utils';
import { encodeSetupDolomite4626Token } from '../../../../utils/encoding/dolomite-4626-token-encoder-utils';

/**
 * This script encodes the following transactions:
 * - Adds the first dTokens for the markets
 */
async function main(): Promise<DryRunOutput<Network.Botanix>> {
  const network = await getAndCheckSpecificNetwork(Network.Botanix);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const pBtc = await deployDolomiteErc4626WithPayableToken(core, 'Pbtc', core.marketIds.pbtc);
  const weth = await deployDolomiteErc4626Token(core, 'Weth', core.marketIds.weth);
  const usdc = await deployDolomiteErc4626Token(core, 'Usdc', core.marketIds.usdc);
  const stBtc = await deployDolomiteErc4626Token(core, 'Stbtc', core.marketIds.stBtc);
  const usdt = await deployDolomiteErc4626Token(core, 'Usdt', core.marketIds.usdt);

  const transactions: EncodedTransaction[] = [
    ...await encodeSetupDolomite4626Token(core, pBtc),
    ...await encodeSetupDolomite4626Token(core, weth),
    ...await encodeSetupDolomite4626Token(core, usdc),
    ...await encodeSetupDolomite4626Token(core, stBtc),
    ...await encodeSetupDolomite4626Token(core, usdt),
  ];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    invariants: async () => {
    },
  };
}

doDryRunAndCheckDeployment(main);
