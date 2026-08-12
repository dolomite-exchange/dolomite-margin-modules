import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  encodeSetBorrowCap,
  encodeSetBorrowCapWithMagic, encodeSetIsBorrowOnly,
  encodeSetIsCollateralOnly,
  encodeSetSupplyCap,
  encodeSetSupplyCapWithMagic,
} from 'packages/deployment/src/utils/encoding/dolomite-margin-core-encoder-utils';
import { checkBorrowCap, checkIsCollateralOnly, checkSupplyCap } from 'packages/deployment/src/utils/invariant-utils';
import { encodeInsertChainlinkOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';

/**
 * This script encodes the following transactions:
 * - Update oracles to Chainlink
 */
async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    ...await encodeInsertChainlinkOracleV3(core, core.tokens.fbtc),
    ...await encodeInsertChainlinkOracleV3(core, core.tokens.meth),
    ...await encodeInsertChainlinkOracleV3(core, core.tokens.usdc),
    ...await encodeInsertChainlinkOracleV3(core, core.tokens.usde),
    ...await encodeInsertChainlinkOracleV3(core, core.tokens.usdt),
    ...await encodeInsertChainlinkOracleV3(core, core.tokens.weth),
    ...await encodeInsertChainlinkOracleV3(core, core.tokens.wmnt),

    await encodeSetSupplyCapWithMagic(core, core.marketIds.usdc, 25_000_000),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.usde, 25_000_000),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.usdt, 25_000_000),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.weth, 10_000),

    await encodeSetBorrowCapWithMagic(core, core.marketIds.usdc, 20_000_000),
    await encodeSetBorrowCapWithMagic(core, core.marketIds.usde, 20_000_000),
    await encodeSetBorrowCapWithMagic(core, core.marketIds.usdt, 20_000_000),
    await encodeSetBorrowCapWithMagic(core, core.marketIds.weth, 9_000),

    await encodeSetSupplyCap(core, core.marketIds.cmEth, 1),
    await encodeSetSupplyCap(core, core.marketIds.dPtCmethFeb2025, 1),
    await encodeSetSupplyCap(core, core.marketIds.dPtMethDec2024, 1),
    await encodeSetSupplyCap(core, core.marketIds.dPtMntOct2024, 1),
    await encodeSetSupplyCap(core, core.marketIds.dPtUsdeJul2024, 1),
    await encodeSetSupplyCap(core, core.marketIds.dPtUsdeDec2024, 1),
    await encodeSetSupplyCap(core, core.marketIds.fbtc, 1),

    await encodeSetBorrowCap(core, core.marketIds.cmEth, 1),
    await encodeSetBorrowCap(core, core.marketIds.fbtc, 1),
    await encodeSetBorrowCap(core, core.marketIds.usdy, 1),

    await encodeSetIsCollateralOnly(core, core.marketIds.cmEth, true),
    await encodeSetIsCollateralOnly(core, core.marketIds.fbtc, true),

    await encodeSetIsBorrowOnly(core, core.marketIds.cmEth, true),
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
      await checkSupplyCap(core, core.marketIds.cmEth, 1);
      await checkSupplyCap(core, core.marketIds.fbtc, 1);

      await checkBorrowCap(core, core.marketIds.cmEth, 1);
      await checkBorrowCap(core, core.marketIds.fbtc, 1);

      await checkIsCollateralOnly(core, core.marketIds.cmEth, true);
      await checkIsCollateralOnly(core, core.marketIds.fbtc, true);
    },
  };
}

doDryRunAndCheckDeployment(main);
