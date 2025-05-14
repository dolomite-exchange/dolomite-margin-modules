import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { GMXV2_TOKEN_ADDRESS_MAP } from 'packages/base/src/utils/constants';
import { encodeInsertChainlinkOracleV3 } from 'packages/deployment/src/utils/encoding/oracle-encoder-utils';

/**
 * This script encodes the following transactions:
 * - Adds the GLV/ETH GM markets index tokens to the oracle aggregator
 * - Adds the GLV/BTC GM markets index tokens to the oracle aggregator
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const tokenSymbols = Object.keys(GMXV2_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]);
  const transactions: EncodedTransaction[] = [];

  for (const tokenSymbol of tokenSymbols) {
    const tokenAddress = GMXV2_TOKEN_ADDRESS_MAP[Network.ArbitrumOne][tokenSymbol];
    transactions.push(
      ...(await encodeInsertChainlinkOracleV3(core, { address: tokenAddress } as any))
    );
  }
  
  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
    },
    invariants: async () => {
      for (const tokenSymbol of tokenSymbols) {
        const tokenAddress = GMXV2_TOKEN_ADDRESS_MAP[Network.ArbitrumOne][tokenSymbol];
        console.log(tokenSymbol + ' price: ' + (await core.oracleAggregatorV2.getPrice(tokenAddress)).value.toString());
      }
    },
  };
}

doDryRunAndCheckDeployment(main);
