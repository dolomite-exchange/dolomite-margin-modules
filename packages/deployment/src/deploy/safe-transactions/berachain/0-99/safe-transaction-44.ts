import { BigNumberish } from 'ethers';
import { formatUnits, parseEther } from 'ethers/lib/utils';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ONE_BI } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { IERC20, IERC20Metadata__factory, TestPriceOracle__factory } from '../../../../../../base/src/types';
import { BTC_PLACEHOLDER_MAP } from '../../../../../../base/src/utils/constants';
import { CoreProtocolBerachain } from '../../../../../../base/test/utils/core-protocols/core-protocol-berachain';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import { encodeSetSupplyCap } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import {
  encodeInsertChronicleOracleV3,
  encodeInsertRedstoneOracleV3, encodeTestOracleAndDisableSupply,
} from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';
import ModuleDeployments from '../../../deployments.json';

const BTC_PRICE_8D = '1050000000000000000000000000000000'; // $105k
const BTC_PRICE_18D = parseEther(`${98_000}`); // $105k
const ETH_PRICE = parseEther(`${2_750}`); // $2,750
const STABLE_COIN_PRICE_18D = parseEther(`${1}`);

/**
 * This script encodes the following transactions:
 * - Encodes the proper prices for each asset and lowers supply cap if necessary
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    ...(await encodeInsertChronicleOracleV3(core, core.tokens.honey)),
    ...(await encodeInsertChronicleOracleV3(core, core.tokens.usdc)),
    ...(await encodeInsertChronicleOracleV3(core, core.tokens.usdt)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.usde)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.sUsde)),
    ...(await encodeInsertChronicleOracleV3(core, core.tokens.weth)),
    ...(await encodeInsertChronicleOracleV3(core, core.tokens.wbtc)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.btcPlaceholder)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.solvBtc)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.solvBtcBbn)),
    ...(await encodeInsertChronicleOracleV3(core, core.tokens.pumpBtc)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.eBtc)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.weEth)),
    ...(await encodeInsertChronicleOracleV3(core, core.tokens.stone)),
    ...(await encodeInsertChronicleOracleV3(core, core.tokens.ylPumpBtc)),
    ...(await encodeInsertChronicleOracleV3(core, core.tokens.usda)),
    ...(await encodeInsertChronicleOracleV3(core, core.tokens.sUsda)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.rswEth)),
    ...(await encodeInsertChronicleOracleV3(core, core.tokens.rsEth)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.lbtc)),
    // Test oracles
    ...(await encodeTestOracleAndDisableSupply(core, core.tokens.nect, STABLE_COIN_PRICE_18D)),
    ...(await encodeTestOracleAndDisableSupply(core, core.tokens.stonebtc, BTC_PRICE_18D)),
    ...(await encodeTestOracleAndDisableSupply(core, core.tokens.uniBtc, BTC_PRICE_8D)),
    ...(await encodeTestOracleAndDisableSupply(core, core.tokens.beraEth, ETH_PRICE)),
    ...(await encodeTestOracleAndDisableSupply(core, core.tokens.ylStEth, ETH_PRICE)),
    ...(await encodeTestOracleAndDisableSupply(core, core.tokens.ylBtcLst, BTC_PRICE_8D)),
    ...(await encodeTestOracleAndDisableSupply(core, core.tokens.stBtc, BTC_PRICE_18D)),
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
      await printPriceForVisualCheck(core, core.tokens.honey);
      await printPriceForVisualCheck(core, core.tokens.usdc);
      await printPriceForVisualCheck(core, core.tokens.usdt);
      await printPriceForVisualCheck(core, core.tokens.usde);
      await printPriceForVisualCheck(core, core.tokens.sUsde);
      await printPriceForVisualCheck(core, core.tokens.weth);
      await printPriceForVisualCheck(core, core.tokens.wbtc);
      await printPriceForVisualCheck(core, core.tokens.btcPlaceholder);
      await printPriceForVisualCheck(core, core.tokens.solvBtc);
      await printPriceForVisualCheck(core, core.tokens.solvBtcBbn);
      await printPriceForVisualCheck(core, core.tokens.pumpBtc);
      await printPriceForVisualCheck(core, core.tokens.eBtc);
      await printPriceForVisualCheck(core, core.tokens.weEth);
      await printPriceForVisualCheck(core, core.tokens.stone);
      await printPriceForVisualCheck(core, core.tokens.ylPumpBtc);
      await printPriceForVisualCheck(core, core.tokens.usda);
      await printPriceForVisualCheck(core, core.tokens.sUsda);
      await printPriceForVisualCheck(core, core.tokens.rswEth);
      await printPriceForVisualCheck(core, core.tokens.rsEth);
      await printPriceForVisualCheck(core, core.tokens.lbtc);
      await printPriceForVisualCheck(core, core.tokens.nect);
      await printPriceForVisualCheck(core, core.tokens.stonebtc);
      await printPriceForVisualCheck(core, core.tokens.uniBtc);
      await printPriceForVisualCheck(core, core.tokens.beraEth);
      await printPriceForVisualCheck(core, core.tokens.ylStEth);
      await printPriceForVisualCheck(core, core.tokens.ylBtcLst);
      await printPriceForVisualCheck(core, core.tokens.stBtc);
    },
  };
}

doDryRunAndCheckDeployment(main);
