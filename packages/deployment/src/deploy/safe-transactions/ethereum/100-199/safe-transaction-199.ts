import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import {
  LowerPercentage,
  OptimalUtilizationRate,
  TargetCollateralization,
  TargetLiquidationPenalty,
  UpperPercentage,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import { encodeSetModularInterestSetterParams } from '../../../../utils/encoding/interest-setter-encoder-utils';
import { encodeInsertOracle } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  checkInterestSetter,
  checkMarket,
  checkSupplyCap,
  printPriceForVisualCheck,
} from '../../../../utils/invariant-utils';
import { deployContractAndSave } from 'packages/deployment/src/utils/deploy-utils';
import { ST_ETH_MAP } from 'packages/base/src/utils/constants';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { StEthExchangeRatePriceOracle__factory } from 'packages/oracles/src/types';

/**
 * This script encodes the following transactions:
 * - Deploys the StEthExchangeRatePriceOracle
 * - Lists wstETH asset
 */
async function main(): Promise<DryRunOutput<Network.Ethereum>> {
  const network = await getAndCheckSpecificNetwork(Network.Ethereum);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(false, network),
  });

  const stEthExchangeRatePriceOracleAddress = await deployContractAndSave(
    'StEthExchangeRatePriceOracle',
    [ST_ETH_MAP[Network.Ethereum].address, core.tokens.wstEth.address, core.dolomiteMargin.address],
  );
  const stEthExchangeRatePriceOracle = StEthExchangeRatePriceOracle__factory.connect(stEthExchangeRatePriceOracleAddress, core.hhUser1);

  const transactions: EncodedTransaction[] = [
    await encodeSetModularInterestSetterParams(
      core,
      core.tokens.wstEth,
      LowerPercentage._4, // @follow-up @Corey adjust these
      UpperPercentage._60,
      OptimalUtilizationRate._80,
    ),
    ...(await encodeInsertOracle(core, core.tokens.wstEth, stEthExchangeRatePriceOracle, core.tokens.weth)),
    ...(await encodeAddMarket(
      core,
      core.tokens.wstEth,
      core.oracleAggregatorV2,
      core.interestSetters.modularInterestSetter,
      TargetCollateralization._128, // @follow-up @Corey adjust
      TargetLiquidationPenalty._7_5,
      parseEther(`${10_000}`),
      parseEther(`${1_000}`),
      false,
    )),
    // @follow-up @Corey adjust risk categories
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
      assertHardhatInvariant(
        await stEthExchangeRatePriceOracle.LIDO() === ST_ETH_MAP[Network.Ethereum].address,
        'Invalid LIDO address',
      );
      assertHardhatInvariant(
        await stEthExchangeRatePriceOracle.WST_ETH() === core.tokens.wstEth.address,
        'Invalid WST_ETH address',
      )
      assertHardhatInvariant(
        await stEthExchangeRatePriceOracle.DOLOMITE_MARGIN() === core.dolomiteMargin.address,
        'Invalid DOLOMITE_MARGIN address',
      )

      await printPriceForVisualCheck(core, core.tokens.wstEth);
      await checkMarket(core, core.marketIds.wstEth, core.tokens.wstEth);
      await checkInterestSetter(core, core.marketIds.wstEth, core.interestSetters.modularInterestSetter);
      await checkSupplyCap(core, core.marketIds.wstEth, parseEther(`${10_000}`));
    },
  };
}

doDryRunAndCheckDeployment(main);
