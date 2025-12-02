import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { deployContractAndSave } from 'packages/deployment/src/utils/deploy-utils';
import { ConstantPriceOracle__factory } from 'packages/oracles/src/types';
import { printPriceForVisualCheck } from 'packages/deployment/src/utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Deploys a ConstantPriceOracle for USDY
 * - Sets USDY market to isClosing and sets the supply cap to 1 wei
 * - Updates USDY on the OracleAggregator
 */
async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const constantPriceOracleAddress = await deployContractAndSave(
    'ConstantPriceOracle',
    [[core.tokens.usdy.address], [ONE_ETH_BI], core.dolomiteMargin.address], // @follow-up @Corey, this hardcodes the price to $1, but please check which price you want
    'ConstantPriceOracleV1',
  );
  const constantPriceOracle = ConstantPriceOracle__factory.connect(constantPriceOracleAddress, core.governance);

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetIsClosing',
      [core.marketIds.usdy, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetMaxSupplyWei',
      [core.marketIds.usdy, 1],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregatorV2: core.oracleAggregatorV2 },
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          token: core.tokens.usdy.address,
          decimals: 18,
          oracleInfos: [
            {
              oracle: constantPriceOracle.address,
              tokenPair: ADDRESS_ZERO,
              weight: 100,
            },
          ],
        },
      ],
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
      await printPriceForVisualCheck(core, core.tokens.usdy);
      assertHardhatInvariant(
        await core.dolomiteMargin.getMarketIsClosing(core.marketIds.usdy),
        'USDY market is not closing',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketMaxSupplyWei(core.marketIds.usdy)).value.eq(1),
        'USDY market max supply wei is not 1',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
