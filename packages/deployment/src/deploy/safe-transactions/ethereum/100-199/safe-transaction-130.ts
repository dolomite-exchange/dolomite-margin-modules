import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  LowerPercentage,
  OptimalUtilizationRate,
  UpperPercentage,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeModularInterestSetterParams } from '../../../../utils/encoding/interest-setter-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { deployDolomiteErc4626Token, deployDolomiteErc4626WithPayableToken } from '../../../../utils/deploy-utils';
import { encodeSetupDolomite4626Token } from '../../../../utils/encoding/dolomite-4626-token-encoder-utils';

/**
 * This script encodes the following transactions:
 * - Creates initial dTokens
 */
async function main(): Promise<DryRunOutput<Network.Ethereum>> {
  const network = await getAndCheckSpecificNetwork(Network.Ethereum);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const aave = await deployDolomiteErc4626Token(core, 'Aave', core.marketIds.aave);
  const crv = await deployDolomiteErc4626Token(core, 'Crv', core.marketIds.crv);
  const link = await deployDolomiteErc4626Token(core, 'Link', core.marketIds.link);
  const mEth = await deployDolomiteErc4626Token(core, 'Meth', core.marketIds.mEth);
  const rUsd = await deployDolomiteErc4626Token(core, 'RUsd', core.marketIds.rUsd);
  const sUsde = await deployDolomiteErc4626Token(core, 'SUsde', core.marketIds.sUsde);
  const srUsd = await deployDolomiteErc4626Token(core, 'SrUsd', core.marketIds.srUsd);
  const usdc = await deployDolomiteErc4626Token(core, 'Usdc', core.marketIds.usdc);
  const usd1 = await deployDolomiteErc4626Token(core, 'Usd1', core.marketIds.usd1);
  const usdt = await deployDolomiteErc4626Token(core, 'Usdt', core.marketIds.usdt);
  const wbtc = await deployDolomiteErc4626WithPayableToken(core, 'Wbtc', core.marketIds.wbtc);
  const weth = await deployDolomiteErc4626WithPayableToken(core, 'Weth', core.marketIds.weth);
  const weEth = await deployDolomiteErc4626WithPayableToken(core, 'WeEth', core.marketIds.weEth);

  const transactions: EncodedTransaction[] = [
    ...await encodeSetupDolomite4626Token(core, aave),
    ...await encodeSetupDolomite4626Token(core, crv),
    ...await encodeSetupDolomite4626Token(core, link),
    ...await encodeSetupDolomite4626Token(core, mEth),
    ...await encodeSetupDolomite4626Token(core, rUsd),
    ...await encodeSetupDolomite4626Token(core, sUsde),
    ...await encodeSetupDolomite4626Token(core, srUsd),
    ...await encodeSetupDolomite4626Token(core, usdc),
    ...await encodeSetupDolomite4626Token(core, usd1),
    ...await encodeSetupDolomite4626Token(core, usdt),
    ...await encodeSetupDolomite4626Token(core, wbtc),
    ...await encodeSetupDolomite4626Token(core, weth),
    ...await encodeSetupDolomite4626Token(core, weEth),
  ];

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
