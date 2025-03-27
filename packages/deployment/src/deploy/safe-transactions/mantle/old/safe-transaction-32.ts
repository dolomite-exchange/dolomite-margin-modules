import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from 'packages/base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployPendlePtSystem,

} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddIsolationModeMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import { encodeInsertPendlePtOracle } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Sets up the PT-MNT ecosystem
 */
async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];
  const ptMntMarketId = await core.dolomiteMargin.getNumMarkets();

  const mntSystem = await deployPendlePtSystem(
    core,
    'MntOct2024',
    core.pendleEcosystem.mntOct2024.mntMarket,
    core.pendleEcosystem.mntOct2024.ptOracle,
    core.pendleEcosystem.mntOct2024.ptMntToken,
    core.pendleEcosystem.mntOct2024.syMntToken,
    core.tokens.wmnt,
  );

  transactions.push(
    await encodeInsertPendlePtOracle(core, mntSystem, core.tokens.wmnt),
    ...(await encodeAddIsolationModeMarket(
      core,
      mntSystem.factory,
      core.oracleAggregatorV2,
      mntSystem.unwrapper,
      mntSystem.wrapper,
      ptMntMarketId,
      TargetCollateralization._125,
      TargetLiquidationPenalty.Base,
      parseEther(`${500_000}`),
    )),
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
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(ptMntMarketId)) === mntSystem.factory.address,
        'Invalid PT-MNT market ID',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketPriceOracle(ptMntMarketId)) === core.oracleAggregatorV2.address,
        'Invalid oracle for PT-MNT',
      );
      assertHardhatInvariant(
        await mntSystem.factory.isTokenConverterTrusted(mntSystem.unwrapper.address),
        'Unwrapper not trusted',
      );
      assertHardhatInvariant(
        await mntSystem.factory.isTokenConverterTrusted(mntSystem.wrapper.address),
        'Wrapper not trusted',
      );
      console.log('\tPrice for PT-MNT', (await core.dolomiteMargin.getMarketPrice(ptMntMarketId)).value.toString());
    },
  };
}

doDryRunAndCheckDeployment(main);
