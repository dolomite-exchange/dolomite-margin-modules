import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { TargetCollateralization, TargetLiquidationPenalty } from 'packages/base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  deployPendlePtSystem,

} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import { encodeAddIsolationModeMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Deploys PT-weETH (DEC 2024)
 * - Deploys PT-rsETH (DEC 2024)
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });
  let incrementor = 0;
  const numMarkets = await core.dolomiteMargin.getNumMarkets();

  const transactions = [];
  const ptEEthMarketId = numMarkets.add(incrementor++);
  const ptRsEthMarketId = numMarkets.add(incrementor++);
  const weEthPendleSystem = await deployPendlePtSystem(
    core,
    'WeETHDec2024',
    core.pendleEcosystem.weEthDec2024.weEthMarket,
    core.pendleEcosystem.weEthDec2024.ptOracle,
    core.pendleEcosystem.weEthDec2024.ptWeEthToken,
    core.pendleEcosystem.syWeEthToken,
    core.tokens.weEth,
  );
  const rsEthPendleSystem = await deployPendlePtSystem(
    core,
    'RsETHDec2024',
    core.pendleEcosystem.rsEthDec2024.rsEthMarket,
    core.pendleEcosystem.rsEthDec2024.ptOracle,
    core.pendleEcosystem.rsEthDec2024.ptRsEthToken,
    core.pendleEcosystem.syRsEthToken,
    core.tokens.rsEth,
  );

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'oracleAggregatorV2', 'ownerInsertOrUpdateToken', [
      {
        token: weEthPendleSystem.factory.address,
        decimals: await weEthPendleSystem.factory.decimals(),
        oracleInfos: [
          {
            oracle: weEthPendleSystem.oracle.address,
            tokenPair: core.tokens.eEth.address,
            weight: 100,
          },
        ],
      },
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'oracleAggregatorV2', 'ownerInsertOrUpdateToken', [
      {
        token: rsEthPendleSystem.factory.address,
        decimals: await rsEthPendleSystem.factory.decimals(),
        oracleInfos: [
          {
            oracle: rsEthPendleSystem.oracle.address,
            tokenPair: core.tokens.weth.address,
            weight: 100,
          },
        ],
      },
    ]),
    ...(await encodeAddIsolationModeMarket(
      core,
      weEthPendleSystem.factory,
      core.oracleAggregatorV2,
      weEthPendleSystem.unwrapper,
      weEthPendleSystem.wrapper,
      ptEEthMarketId,
      TargetCollateralization._120,
      TargetLiquidationPenalty._6,
      parseEther(`${4_000}`),
    )),
    ...(await encodeAddIsolationModeMarket(
      core,
      rsEthPendleSystem.factory,
      core.oracleAggregatorV2,
      rsEthPendleSystem.unwrapper,
      rsEthPendleSystem.wrapper,
      ptRsEthMarketId,
      TargetCollateralization._120,
      TargetLiquidationPenalty._6,
      parseEther(`${2_000}`),
    )),
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
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(ptEEthMarketId)) === weEthPendleSystem.factory.address,
        'Invalid PT-weETH market ID',
      );
      console.log(
        '\tPT-eETH (DEC-2024) price:',
        (await core.dolomiteMargin.getMarketPrice(ptEEthMarketId)).value.toString(),
      );

      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(ptRsEthMarketId)) === rsEthPendleSystem.factory.address,
        'Invalid PT-rsETH market ID',
      );
      console.log(
        '\tPT-rsETH (DEC-2024) price:',
        (await core.dolomiteMargin.getMarketPrice(ptRsEthMarketId)).value.toString(),
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
