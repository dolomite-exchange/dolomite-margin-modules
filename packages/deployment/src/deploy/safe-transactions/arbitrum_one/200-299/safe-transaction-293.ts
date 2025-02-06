import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,


} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import { prettyPrintEncodeInsertChainlinkOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

const GRAI_FRAX_POOL = '0x6E0Ced11922386900BE369cBBF3cdb971dc58487';

/**
 * This script encodes the following transactions:
 * - Deploys the GRAI oracle
 * - Adds GRAI as a market on Dolomite
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const graiFraxOracleAddress = await deployContractAndSave(
    'RamsesLegacyPriceOracle',
    [
      core.tokens.grai.address,
      GRAI_FRAX_POOL,
      core.dolomiteRegistry.address,
      core.dolomiteMargin.address,
    ],
    'GraiFraxPriceOracleV3',
  );

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregator: core.oracleAggregatorV2 },
      'oracleAggregator',
      'ownerInsertOrUpdateToken',
      [
        {
          oracleInfos: [
            { oracle: graiFraxOracleAddress, tokenPair: core.tokens.frax.address, weight: 100 },
          ],
          decimals: 18,
          token: core.tokens.grai.address,
        },
      ],
    ),
    ...await prettyPrintEncodeInsertChainlinkOracleV3(
      core,
      core.tokens.frax,
      false,
    ),
    ...await prettyPrintEncodeAddMarket(
      core,
      core.tokens.grai,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction16L84U90OInterestSetter,
      TargetCollateralization._125,
      TargetLiquidationPenalty._7,
      parseEther(`${100_000}`),
      parseEther(`${80_000}`),
      false,
    ),
  )
  ;

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    skipTimeDelay: true,
    invariants: async () => {
      expect(await core.dolomiteMargin.getMarketIdByTokenAddress(core.tokens.grai.address)).to.eq(core.marketIds.grai);
      console.log('\tPrice', (await core.dolomiteMargin.getMarketPrice(core.marketIds.grai)).value.toString());
    },
  };
}

doDryRunAndCheckDeployment(main);
