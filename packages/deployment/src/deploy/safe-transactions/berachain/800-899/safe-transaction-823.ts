import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeInsertConstantPriceOracleV3,
  encodeInsertRedstoneOracleV3,
} from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';
import { parseEther } from 'ethers/lib/utils';

/**
 * This script encodes the following transactions:
 * - Update oracles for assets
 *    - eBTC -> switch to BTC oracle, already wind down only
 *    - LBTC -> switch to BTC oracle, already wind down only
 *    - pumpBTC -> switch to BTC oracle, already wind down only
 *    - rsETH -> switch to constant oracle to ETH, already wind down only
 *    - rswETH -> switch to constant oracle to ETH, already wind down only
 *    - solvBTC -> switch to BTC oracle, already wind down only
 *    - stone -> switch to ETH oracle, already wind down
 *    - weETH -> switch to constant oracle to ETH, already wind down only
 *    - ylstETH -> switch to constant oracle to ETH, already wind down only
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.eBtc)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.lbtc)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.pumpBtc)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.solvBtc)),

    ...(await encodeInsertConstantPriceOracleV3(
      core,
      core.tokens.rsEth,
      parseEther(`${1.078110791623618630}`),
      core.tokens.weth.address,
    )),
    ...(await encodeInsertConstantPriceOracleV3(
      core,
      core.tokens.rswEth,
      parseEther(`${1.07705919}`),
      core.tokens.weth.address,
    )),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.stone)),
    ...(await encodeInsertConstantPriceOracleV3(
      core,
      core.tokens.weEth,
      parseEther(`${1.10161758}`),
      core.tokens.weth.address,
    )),
    ...(await encodeInsertConstantPriceOracleV3(
      core,
      core.tokens.ylStEth,
      parseEther(`${1.07431448}`),
      core.tokens.weth.address,
    )),
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
      await printPriceForVisualCheck(core, core.tokens.rswEth);
      await printPriceForVisualCheck(core, core.tokens.weEth);
      await printPriceForVisualCheck(core, core.tokens.ylStEth);
    },
  };
}

doDryRunAndCheckDeployment(main);
