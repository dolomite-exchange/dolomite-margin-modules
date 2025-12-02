import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeSetGlobalOperator } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import { encodeInsertChainlinkOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';

const HANDLER = '0x1fF6B8E1192eB0369006Bbad76dA9068B68961B2';
const USDC_FUND = '0x1fF6B8E1192eB0369006Bbad76dA9068B68961B2';

/**
 * This script encodes the following transactions:
 * - Deploy the GLP redemption operator
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const operator = await deployContractAndSave(
    'GLPRedemptionOperator',
    [
      HANDLER,
      USDC_FUND,
      core.marketIds.usdc,
      core.gmxEcosystem.live.dGlp.address,
      core.gmxEcosystem.live.glpIsolationModeUnwrapperTraderV1.address,
      core.dolomiteMargin.address,
    ],
    'GLPRedemptionOperatorV1',
  );
  const transactions: EncodedTransaction[] = [
    await encodeSetGlobalOperator(core, operator, true),
    ...(await encodeInsertChainlinkOracleV3(core, core.tokens.rsEth)),
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
    invariants: async () => {
      await printPriceForVisualCheck(core, core.tokens.rsEth);
    },
  };
}

doDryRunAndCheckDeployment(main);
