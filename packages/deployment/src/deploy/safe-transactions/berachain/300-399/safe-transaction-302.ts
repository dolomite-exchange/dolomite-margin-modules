import { expect } from 'chai';
import { formatEther } from 'ethers/lib/utils';
import { DOLOMITE_DAO_GNOSIS_SAFE_MAP } from '../../../../../../base/src/utils/constants';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network, ONE_ETH_BI } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import {
  encodeSetSingleCollateralWithStrictDebtByMarketId,
  encodeSetSupplyCapWithMagic,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Set the treasury to the DAO
 * - Update the uniBTC borrow schematics
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const params = await core.dolomiteAccountRiskOverrideSetter.getRiskFeatureForSingleCollateralByMarketId(
    core.marketIds.uniBtc,
  );
  const other = params.find(p => p.debtMarketIds.some(d => d.eq(core.marketIds.nect)))!;
  const btc = params.find(p => !p.debtMarketIds.some(d => d.eq(core.marketIds.nect)))!;

  const treasuryAddress = DOLOMITE_DAO_GNOSIS_SAFE_MAP[network]!;
  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(core, core.tokenomicsAirdrop, 'optionAirdrop', 'ownerSetTreasury', [
      treasuryAddress,
    ]),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.uniBtc, 75),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(core, core.marketIds.uniBtc, [
      {
        debtMarketIds: other.debtMarketIds,
        marginRatioOverride: formatEther(other.marginRatioOverride.value.add(ONE_ETH_BI)) as TargetCollateralization,
        liquidationRewardOverride: formatEther(other.liquidationRewardOverride.value) as TargetLiquidationPenalty,
      },
      {
        debtMarketIds: [core.marketIds.wbtc, ...btc.debtMarketIds],
        marginRatioOverride: formatEther(btc.marginRatioOverride.value.add(ONE_ETH_BI)) as TargetCollateralization,
        liquidationRewardOverride: TargetLiquidationPenalty._5,
      },
    ]),
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
      expect(await core.tokenomicsAirdrop.optionAirdrop.treasury()).to.eq(treasuryAddress);
    },
  };
}

doDryRunAndCheckDeployment(main);
