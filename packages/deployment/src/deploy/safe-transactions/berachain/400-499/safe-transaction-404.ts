import { PartnerClaimExcessTokens__factory } from '@dolomite-exchange/modules-admin/src/types';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

const RESERVOIR_PARTNER_ADDRESS = '0x5e102471d7084884836eE994877635c8399BD7b7';

/**
 * This script encodes the following transactions:
 * - Set parameters for pol-rUSD bribing
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const partnerClaim = PartnerClaimExcessTokens__factory.connect(
    '0xf3550Ed83E3FE0616282da4182589636C7a32ea2',
    core.hhUser1,
  );
  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(core, { partnerClaim }, 'partnerClaim', 'ownerSetPartnerInfo', [
      core.marketIds.rUsd,
      RESERVOIR_PARTNER_ADDRESS,
      { value: parseEther('0.6') },
    ]),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomite: core.dolomiteMargin },
      'dolomite',
      'ownerSetEarningsRateOverride',
      [core.marketIds.rUsd, { value: parseEther('0.5') }],
    ),
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
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);
