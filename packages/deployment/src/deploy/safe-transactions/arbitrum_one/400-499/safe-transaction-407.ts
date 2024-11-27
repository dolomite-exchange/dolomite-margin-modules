import {
  getMagicGLPWithChainlinkAutomationPriceOracleConstructorParams,
} from 'packages/abracadabra/src/abracadabra-constructors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { ADDRESS_ZERO, Network } from 'packages/base/src/utils/no-deps-constants';
import { deployContractAndSave, prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Updates the price oracle for mGLP to use the new Chainlink Automation Registry
 * - Lowers the supply cap of mGLP to 100,000 units
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const oracleAddress = await deployContractAndSave(
    'MagicGLPWithChainlinkAutomationPriceOracle',
    getMagicGLPWithChainlinkAutomationPriceOracleConstructorParams(core),
    'MagicGLPWithChainlinkAutomationPriceOracleV2',
  );

  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'oracleAggregatorV2', 'ownerInsertOrUpdateToken', [
      {
        token: core.tokens.mGlp.address,
        decimals: 18,
        oracleInfos: [
          {
            oracle: oracleAddress,
            tokenPair: ADDRESS_ZERO,
            weight: 100,
          },
        ],
      },
    ]),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetMaxWei',
      [core.marketIds.magicGlp, parseEther(`${100_000}`)],
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
      const price = await core.dolomiteMargin.getMarketPrice(core.marketIds.magicGlp);
      console.log('\tmGLP price: ', price.value.toString());
    },
  };
}

doDryRunAndCheckDeployment(main);
