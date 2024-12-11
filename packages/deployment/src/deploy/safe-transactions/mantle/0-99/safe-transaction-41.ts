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

const OLD_METH_ADDRESS = '0x7656b1417886B89D6D72e8360923146D500c6c63';
const OLD_USDC_ADDRESS = '0x3d05E4041d3a7388d566BCF4B2a5A3f0977eA9a3';
const OLD_USDT_ADDRESS = '0x64f7a2A0F32654B09C66aa64405661F27039A249';
const OLD_WBTC_ADDRESS = '0x4723da2196668D26c76885fe23d568e9688F812D';
const OLD_WETH_ADDRESS = '0x02942CDe28029D13e070fc5FFd160e51E44522cc';
const OLD_WMNT_ADDRESS = '0x141b3dD69FdeF1782E8d5dFae62D10a297AC56e8';

/**
 * This script encodes the following transactions:
 * - Deploys the 4626 dToken vaults for: DAI, USDC, USDT, WBTC, and WETH
 * - Deprecates the old 4626 dToken vaults
 */
async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const dMethToken = await deployDolomiteErc4626Token(core, 'Meth', core.marketIds.meth);
  const dUsdcToken = await deployDolomiteErc4626Token(core, 'Usdc', core.marketIds.usdc);
  const dUsdtToken = await deployDolomiteErc4626Token(core, 'Usdt', core.marketIds.usdt);
  const dWbtcToken = await deployDolomiteErc4626Token(core, 'Wbtc', core.marketIds.wbtc);
  const dWethToken = await deployDolomiteErc4626Token(core, 'Weth', core.marketIds.weth);
  const dWmntToken = await deployDolomiteErc4626WithPayableToken(core, 'Wmnt', core.marketIds.wmnt);

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      OLD_METH_ADDRESS,
      false,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      OLD_USDC_ADDRESS,
      false,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      OLD_USDT_ADDRESS,
      false,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      OLD_WBTC_ADDRESS,
      false,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      OLD_WETH_ADDRESS,
      false,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      OLD_WMNT_ADDRESS,
      false,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      dMethToken.address,
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
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      dWmntToken.address,
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
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    invariants: async () => {
      const isGlobalOperator = (o: string) => core.dolomiteMargin.getIsGlobalOperator(o);

      assertHardhatInvariant(await isGlobalOperator(dMethToken.address), 'dMethToken is not a global operator');
      assertHardhatInvariant(await isGlobalOperator(dUsdcToken.address), 'dUsdcToken is not a global operator');
      assertHardhatInvariant(await isGlobalOperator(dUsdtToken.address), 'dUsdtToken is not a global operator');
      assertHardhatInvariant(await isGlobalOperator(dWbtcToken.address), 'dWbtcToken is not a global operator');
      assertHardhatInvariant(await isGlobalOperator(dWethToken.address), 'dWethToken is not a global operator');
      assertHardhatInvariant(await isGlobalOperator(dWmntToken.address), 'dWmntToken is not a global operator');
    },
  };
}

doDryRunAndCheckDeployment(main);
