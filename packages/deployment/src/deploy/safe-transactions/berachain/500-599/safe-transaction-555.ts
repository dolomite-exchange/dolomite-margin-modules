import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  AccountRiskOverrideRiskFeature,
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import {
  encodeSetIsBorrowOnly,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { deployContractAndSave } from 'packages/deployment/src/utils/deploy-utils';
import { prettyPrintEncodedDataWithTypeSafety } from 'packages/deployment/src/utils/encoding/base-encoder-utils';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { checkSupplyCap, printPriceForVisualCheck } from 'packages/deployment/src/utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Deploys the ERC4626PriceOracle
 * - List the oriBGT market
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });
  const oriMarketId = await core.dolomiteMargin.getNumMarkets();

  const erc4626PriceOracleAddress = await deployContractAndSave(
    'ERC4626PriceOracle',
    [[core.tokens.oriBgt.address], core.dolomiteMargin.address],
    'ERC4626PriceOracleV1',
  );

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          token: core.tokens.oriBgt.address,
          decimals: 18,
          oracleInfos: [
            { oracle: erc4626PriceOracleAddress, tokenPair: core.tokens.iBgt.address, weight: 100 }
          ],
        },
      ],
    ),
    ...(await encodeAddMarket(
      core,
      core.tokens.oriBgt,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction7L93U90OInterestSetter, // @follow-up Adjust
      TargetCollateralization.Base, // @follow-up Adjust
      TargetLiquidationPenalty.Base, // @follow-up Adjust
      parseEther(`${40_000_000}`), // @follow-up Adjust
      parseEther(`${35_000_000}`), // @follow-up Adjust
      false, // @follow-up Adjust
    )),
    await encodeSetIsBorrowOnly( // @follow-up I think you said borrow only?
      core,
      oriMarketId,
      true,
    ),
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
        (await core.dolomiteMargin.getMarketIdByTokenAddress(core.tokens.oriBgt.address)).eq(oriMarketId),
        'Invalid market id'
      );
      assertHardhatInvariant(
        await core.dolomiteAccountRiskOverrideSetter.getRiskFeatureByMarketId(oriMarketId)
          === AccountRiskOverrideRiskFeature.BORROW_ONLY,
        'Risk feature is not borrow only'
      );
      await checkSupplyCap(core, oriMarketId, parseEther(`${40_000_000}`));
      await printPriceForVisualCheck(core, core.tokens.oriBgt);
    },
  };
}

doDryRunAndCheckDeployment(main);
