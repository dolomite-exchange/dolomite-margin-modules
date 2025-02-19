import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  deployDolomiteErc4626Token,
  deployDolomiteErc4626WithPayableToken,

} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

const OLD_BRIDGED_USDC_ADDRESS = '0x5138B4e470a759BBc1987136ED332fD3C37304AF';
const OLD_DAI_ADDRESS = '0x00173Df2Fe78ffcde820fac4de4a0B061f5EB6B8';
const OLD_USDC_ADDRESS = '0x25e50469e598D3F87462d70b444aD1F8D3a1e434';
const OLD_USDT_ADDRESS = '0x6A5C4862c845f29f1e60DD3777Fc34c87dAC72ea';
const OLD_WBTC_ADDRESS = '0xE5f58660888a8ac026de26095b024122876F6E3f';
const OLD_WETH_ADDRESS = '0xe37B8eBAc74e1f7D0c991276c34EdA12fEF20667';

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
      OLD_BRIDGED_USDC_ADDRESS,
      false,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      OLD_DAI_ADDRESS,
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

      assertHardhatInvariant(
        await isGlobalOperator(dBridgedUsdcToken.address),
        'dBridgedUsdcToken is not a global operator',
      );
      assertHardhatInvariant(await isGlobalOperator(dDaiToken.address), 'dDaiToken is not a global operator');
      assertHardhatInvariant(await isGlobalOperator(dUsdcToken.address), 'dUsdcToken is not a global operator');
      assertHardhatInvariant(await isGlobalOperator(dUsdtToken.address), 'dUsdtToken is not a global operator');
      assertHardhatInvariant(await isGlobalOperator(dWbtcToken.address), 'dWbtcToken is not a global operator');
      assertHardhatInvariant(await isGlobalOperator(dWethToken.address), 'dWethToken is not a global operator');
    },
  };
}

doDryRunAndCheckDeployment(main);
