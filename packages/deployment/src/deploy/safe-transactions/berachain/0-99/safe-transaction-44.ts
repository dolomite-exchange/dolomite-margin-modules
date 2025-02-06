import { BigNumberish } from 'ethers';
import { formatUnits, parseEther } from 'ethers/lib/utils';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ONE_BI } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { IERC20, IERC20Metadata__factory, TestPriceOracle__factory } from '../../../../../../base/src/types';
import { BTC_PLACEHOLDER_MAP } from '../../../../../../base/src/utils/constants';
import { CoreProtocolBerachain } from '../../../../../../base/test/utils/core-protocols/core-protocol-berachain';
import {
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
  prettyPrintEncodeInsertChronicleOracleV3,
  prettyPrintEncodeInsertRedstoneOracleV3,
} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import ModuleDeployments from '../../../deployments.json';
import { encodeSetSupplyCap } from '../utils';

const BTC_PRICE_8D = '1050000000000000000000000000000000'; // $105k
const BTC_PRICE_18D = parseEther(`${98_000}`); // $105k
const ETH_PRICE = parseEther(`${2_750}`); // $2,750
const STABLE_COIN_PRICE_18D = parseEther(`${1}`);

/**
 * This script encodes the following transactions:
 * - Lowers the supply cap of BERA, USD0, and USD0++ to 1 unit
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    ...(await prettyPrintEncodeInsertChronicleOracleV3(core, core.tokens.honey)),
    ...(await prettyPrintEncodeInsertChronicleOracleV3(core, core.tokens.usdc)),
    ...(await prettyPrintEncodeInsertChronicleOracleV3(core, core.tokens.usdt)),
    ...(await prettyPrintEncodeInsertRedstoneOracleV3(core, core.tokens.usde)),
    ...(await prettyPrintEncodeInsertRedstoneOracleV3(core, core.tokens.sUsde)),
    ...(await prettyPrintEncodeInsertChronicleOracleV3(core, core.tokens.weth)),
    ...(await prettyPrintEncodeInsertChronicleOracleV3(core, core.tokens.wbtc)),
    ...(await prettyPrintEncodeInsertRedstoneOracleV3(core, core.tokens.btcPlaceholder)),
    ...(await prettyPrintEncodeInsertRedstoneOracleV3(core, core.tokens.solvBtc)),
    ...(await prettyPrintEncodeInsertRedstoneOracleV3(core, core.tokens.solvBtcBbn)),
    ...(await prettyPrintEncodeInsertChronicleOracleV3(core, core.tokens.pumpBtc)),
    ...(await prettyPrintEncodeInsertRedstoneOracleV3(core, core.tokens.eBtc)),
    ...(await prettyPrintEncodeInsertRedstoneOracleV3(core, core.tokens.weEth)),
    ...(await prettyPrintEncodeInsertChronicleOracleV3(core, core.tokens.stone)),
    ...(await prettyPrintEncodeInsertChronicleOracleV3(core, core.tokens.ylPumpBtc)),
    ...(await prettyPrintEncodeInsertChronicleOracleV3(core, core.tokens.usda)),
    ...(await prettyPrintEncodeInsertChronicleOracleV3(core, core.tokens.sUsda)),
    ...(await prettyPrintEncodeInsertRedstoneOracleV3(core, core.tokens.rswEth)),
    ...(await prettyPrintEncodeInsertChronicleOracleV3(core, core.tokens.rsEth)),
    ...(await prettyPrintEncodeInsertRedstoneOracleV3(core, core.tokens.lbtc)),
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
      await printPrice(core, core.tokens.honey);
      await printPrice(core, core.tokens.usdc);
      await printPrice(core, core.tokens.usdt);
      await printPrice(core, core.tokens.usde);
      await printPrice(core, core.tokens.sUsde);
      await printPrice(core, core.tokens.weth);
      await printPrice(core, core.tokens.wbtc);
      await printPrice(core, core.tokens.btcPlaceholder);
      await printPrice(core, core.tokens.solvBtc);
      await printPrice(core, core.tokens.solvBtcBbn);
      await printPrice(core, core.tokens.pumpBtc);
      await printPrice(core, core.tokens.eBtc);
      await printPrice(core, core.tokens.weEth);
      await printPrice(core, core.tokens.stone);
      await printPrice(core, core.tokens.ylPumpBtc);
      await printPrice(core, core.tokens.usda);
      await printPrice(core, core.tokens.sUsda);
      await printPrice(core, core.tokens.rswEth);
      await printPrice(core, core.tokens.rsEth);
      await printPrice(core, core.tokens.lbtc);
      await printPrice(core, core.tokens.nect);
      await printPrice(core, core.tokens.stonebtc);
      await printPrice(core, core.tokens.uniBtc);
      await printPrice(core, core.tokens.beraEth);
      await printPrice(core, core.tokens.ylStEth);
      await printPrice(core, core.tokens.ylBtcLst);
      await printPrice(core, core.tokens.stBtc);
    },
  };
}

async function encodeTestOracleAndDisableSupply(
  core: CoreProtocolBerachain,
  token: IERC20,
  price: BigNumberish,
): Promise<EncodedTransaction[]> {
  const testPriceOracle = TestPriceOracle__factory.connect(
    ModuleDeployments.TestPriceOracleForAdmin[core.network].address,
    core.hhUser1,
  );
  const marketId = await core.dolomiteMargin.getMarketIdByTokenAddress(token.address);

  return [
    await encodeSetSupplyCap(core, marketId, ONE_BI),
    await prettyPrintEncodedDataWithTypeSafety(core, { testPriceOracle }, 'testPriceOracle', 'setPrice', [
      token.address,
      price,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregatorV2: core.oracleAggregatorV2 },
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          token: token.address,
          decimals: await IERC20Metadata__factory.connect(token.address, core.hhUser1).decimals(),
          oracleInfos: [
            {
              oracle: testPriceOracle.address,
              tokenPair: ADDRESS_ZERO,
              weight: 100,
            },
          ],
        },
      ],
    ),
  ];
}

async function printPrice(core: CoreProtocolBerachain, token: IERC20) {
  const meta = IERC20Metadata__factory.connect(token.address, token.provider);
  const symbol = token.address === BTC_PLACEHOLDER_MAP[core.network].address ? 'BTC' : await meta.symbol();
  const decimals = token.address === BTC_PLACEHOLDER_MAP[core.network].address ? 8 : await meta.decimals();
  const price = await core.oracleAggregatorV2.getPrice(token.address);
  console.log(`\tPrice for ${symbol}:`, formatUnits(price.value, 36 - decimals));
}

doDryRunAndCheckDeployment(main);
