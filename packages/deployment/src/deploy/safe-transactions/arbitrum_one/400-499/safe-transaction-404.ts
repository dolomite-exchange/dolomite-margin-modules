import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Increases the supply cap of GM: AAVE-USD to 1.25M
 * - Increases the supply cap of GM: BTC to 10M
 * - Increases the supply cap of GM: BTC-USD to 30M
 * - Decrease the supply cap of GM: DOGE-USD to 1M
 * - Increases the supply cap of GM: ETH to 15M
 * - Increases the supply cap of GM: ETH-USD to 30M
 * - Increases the supply cap of GM: LINK-USD to 3M
 * - Increases the supply cap of GM: UNI-USD to 1M
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetMaxWei',
      [core.marketIds.dGmAaveUsd, parseEther(`${1_250_000}`)],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetMaxWei',
      [core.marketIds.dGmBtc, parseEther(`${10_000_000}`)],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetMaxWei',
      [core.marketIds.dGmBtcUsd, parseEther(`${30_000_000}`)],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetMaxWei',
      [core.marketIds.dGmDogeUsd, parseEther(`${1_000_000}`)],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetMaxWei',
      [core.marketIds.dGmEth, parseEther(`${15_000_000}`)],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetMaxWei',
      [core.marketIds.dGmEthUsd, parseEther(`${30_000_000}`)],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetMaxWei',
      [core.marketIds.dGmLinkUsd, parseEther(`${3_000_000}`)],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetMaxWei',
      [core.marketIds.dGmUniUsd, parseEther(`${1_000_000}`)],
    ),
  ];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
    },
    invariants: async () => {
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketMaxWei(core.marketIds.dGmAaveUsd)).value.eq(parseEther(`${1_250_000}`)),
        'Invalid GM: AaveUsd max wei',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketMaxWei(core.marketIds.dGmBtc)).value.eq(parseEther(`${10_000_000}`)),
        'Invalid GM: Btc max wei',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketMaxWei(core.marketIds.dGmBtcUsd)).value.eq(parseEther(`${30_000_000}`)),
        'Invalid GM: BtcUsd max wei',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketMaxWei(core.marketIds.dGmDogeUsd)).value.eq(parseEther(`${1_000_000}`)),
        'Invalid GM: DogeUsd max wei',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketMaxWei(core.marketIds.dGmEth)).value.eq(parseEther(`${15_000_000}`)),
        'Invalid GM: Eth max wei',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketMaxWei(core.marketIds.dGmEthUsd)).value.eq(parseEther(`${30_000_000}`)),
        'Invalid GM: EthUsd max wei',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketMaxWei(core.marketIds.dGmLinkUsd)).value.eq(parseEther(`${3_000_000}`)),
        'Invalid GM: LinkUsd max wei',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketMaxWei(core.marketIds.dGmUniUsd)).value.eq(parseEther(`${1_000_000}`)),
        'Invalid GM: UniUsd max wei',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
