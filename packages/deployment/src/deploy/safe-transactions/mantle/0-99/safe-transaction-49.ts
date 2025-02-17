import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { TargetCollateralization, TargetLiquidationPenalty } from 'packages/base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { encodeAddIsolationModeMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import { encodeInsertPendlePtOracle } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  deployPendlePtSystem,

} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';

/**
 * This script encodes the following transactions:
 * - Sets up the PT-mETH ecosystem
 */
async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });
  let incrementor = 0;
  const numMarkets = await core.dolomiteMargin.getNumMarkets();

  const transactions: EncodedTransaction[] = [];
  const ptCmEthMarketId = numMarkets.add(incrementor++);

  const cmEthSystem = await deployPendlePtSystem(
    core,
    'cmETHFeb2025',
    core.pendleEcosystem.cmEthFeb2025.methMarket,
    core.pendleEcosystem.cmEthFeb2025.ptOracle,
    core.pendleEcosystem.cmEthFeb2025.ptMethToken,
    core.pendleEcosystem.cmEthFeb2025.syMethToken,
    core.tokens.cmEth,
  );

  transactions.push(
    await encodeInsertPendlePtOracle(core, cmEthSystem, core.tokens.weth),
    ...(await encodeAddIsolationModeMarket(
      core,
      cmEthSystem.factory,
      core.oracleAggregatorV2,
      cmEthSystem.unwrapper,
      cmEthSystem.wrapper,
      ptCmEthMarketId,
      TargetCollateralization._120,
      TargetLiquidationPenalty._6,
      parseEther(`${3_000}`),
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
        (await core.dolomiteMargin.getMarketTokenAddress(ptCmEthMarketId)) === cmEthSystem.factory.address,
        'Invalid PT-mETH market ID',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketPriceOracle(ptCmEthMarketId)) === core.oracleAggregatorV2.address,
        'Invalid oracle for PT-mETH',
      );
      assertHardhatInvariant(
        await cmEthSystem.factory.isTokenConverterTrusted(cmEthSystem.unwrapper.address),
        'Unwrapper not trusted',
      );
      assertHardhatInvariant(
        await cmEthSystem.factory.isTokenConverterTrusted(cmEthSystem.wrapper.address),
        'Wrapper not trusted',
      );
      console.log('\tPrice for PT-mETH', (await core.dolomiteMargin.getMarketPrice(ptCmEthMarketId)).value.toString());
    },
  };
}

doDryRunAndCheckDeployment(main);
