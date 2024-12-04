import { BigNumberish } from 'ethers';
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
 * - Increases the supply cap of sGMX and gmETH
 * - Lowers the supply cap of gmBTC
 * - Updates the exchange router on the GMX V2 Registry
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetMaxWei',
      [core.marketIds.dGmx, parseEther(`${105_000}`)],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetMaxWei',
      [core.marketIds.dGmBtc, parseEther(`${25_000_000}`)],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetMaxWei',
      [core.marketIds.dGmEth, parseEther(`${40_000_000}`)],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { gmxRegistry: core.gmxV2Ecosystem.live.registry },
      'gmxRegistry',
      'ownerSetGmxExchangeRouter',
      [core.gmxV2Ecosystem.gmxExchangeRouter.address],
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
      const getMaxWei = (o: BigNumberish) => core.dolomiteMargin.getMarketMaxWei(o).then((m) => m.value);

      assertHardhatInvariant(
        (await getMaxWei(core.marketIds.dGmx)).eq(parseEther(`${105_000}`)),
        'Invalid max supply wei for sGMX',
      );
      assertHardhatInvariant(
        (await getMaxWei(core.marketIds.dGmBtc)).eq(parseEther(`${25_000_000}`)),
        'Invalid max supply wei for gmBTC',
      );
      assertHardhatInvariant(
        (await getMaxWei(core.marketIds.dGmEth)).eq(parseEther(`${40_000_000}`)),
        'Invalid max supply wei for gmETH',
      );
      assertHardhatInvariant(
        (await core.gmxV2Ecosystem.live.registry.gmxExchangeRouter()) === core.gmxV2Ecosystem.gmxExchangeRouter.address,
        'Invalid GMX exchange router',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
