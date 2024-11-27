import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployDolomiteErc4626Token,
  deployDolomiteErc4626WithPayableToken,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Deploys the 4626 dToken vaults for: DAI, USDC, USDT, WBTC, and WETH
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const dBridgedUsdcToken = await deployDolomiteErc4626Token(core, 'BridgedUsdc', core.marketIds.usdc);
  const dDaiToken = await deployDolomiteErc4626Token(core, 'Dai', core.marketIds.dai);
  const dUsdcToken = await deployDolomiteErc4626Token(core, 'Usdc', core.marketIds.nativeUsdc);
  const dUsdtToken = await deployDolomiteErc4626Token(core, 'Usdt', core.marketIds.usdt);
  const dWbtcToken = await deployDolomiteErc4626Token(core, 'Wbtc', core.marketIds.wbtc);
  const dWethToken = await deployDolomiteErc4626WithPayableToken(core, 'Weth', core.marketIds.weth);

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      dBridgedUsdcToken.address,
      true,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      dDaiToken.address,
      true,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      dUsdcToken.address,
      true,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      dUsdtToken.address,
      true,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      dWbtcToken.address,
      true,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      dWethToken.address,
      true,
    ]),
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
      const isGlobalOperator = (o: string) => core.dolomiteMargin.getIsGlobalOperator(o);

      assertHardhatInvariant(await isGlobalOperator(dBridgedUsdcToken.address), 'dBridgedUsdcToken is not a global operator');
      assertHardhatInvariant(await isGlobalOperator(dDaiToken.address), 'dDaiToken is not a global operator');
      assertHardhatInvariant(await isGlobalOperator(dUsdcToken.address), 'dUsdcToken is not a global operator');
      assertHardhatInvariant(await isGlobalOperator(dUsdtToken.address), 'dUsdtToken is not a global operator');
      assertHardhatInvariant(await isGlobalOperator(dWbtcToken.address), 'dWbtcToken is not a global operator');
      assertHardhatInvariant(await isGlobalOperator(dWethToken.address), 'dWethToken is not a global operator');
    },
  };
}

doDryRunAndCheckDeployment(main);
