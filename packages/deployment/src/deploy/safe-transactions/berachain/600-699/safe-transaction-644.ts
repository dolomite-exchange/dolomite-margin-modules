import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network, ONE_DAY_SECONDS } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { getVestingClaimsConstructorParams } from '@dolomite-exchange/modules-tokenomics/src/tokenomics-constructors';
import { VestingClaims__factory } from '@dolomite-exchange/modules-tokenomics/src/types';
import { parseEther } from 'ethers/lib/utils';
import { encodeSetModularInterestSetterParams } from '../../../../utils/encoding/interest-setter-encoder-utils';

const TGE_TIMESTAMP = 1745496000;
const ONE_YEAR_SECONDS = 365 * ONE_DAY_SECONDS;
const TWO_YEARS_SECONDS = ONE_YEAR_SECONDS * 2;

/**
 * This script encodes the following transactions:
 * - Updates advisor claims to match expected duration
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const advisorClaimsAddress = await deployContractAndSave(
    'VestingClaims',
    getVestingClaimsConstructorParams(core, core.tokens.dolo, TGE_TIMESTAMP, TWO_YEARS_SECONDS),
    'AdvisorVestingClaimsImplementationV1',
  );
  const advisorClaimsImplementation = VestingClaims__factory.connect(advisorClaimsAddress, core.hhUser1);

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(core, core.tokenomics, 'advisorClaimsProxy', 'upgradeTo', [
      advisorClaimsImplementation.address,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core.tokenomics, 'advisorClaims', 'ownerSetAllocatedAmounts', [
      ['0x0a67BB4110dA098832c2bBDbFFC433AF87414802'],
      [parseEther(`${1_000_000}`)],
    ]),
    await encodeSetModularInterestSetterParams()
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
    },
  };
}

doDryRunAndCheckDeployment(main);
