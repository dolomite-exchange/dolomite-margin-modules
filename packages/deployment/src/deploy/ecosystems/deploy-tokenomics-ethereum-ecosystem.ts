import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAnyNetwork } from 'packages/base/src/utils/dolomite-utils';
import { deployContractAndSave, getDeployerSigner } from 'packages/deployment/src/utils/deploy-utils';
import { doDryRunAndCheckDeployment, EncodedTransaction } from 'packages/deployment/src/utils/dry-run-utils';
import getScriptName from 'packages/deployment/src/utils/get-script-name';
import { DOLOWithOwnable__factory } from 'packages/tokenomics/src/types';
import { GNOSIS_SAFE_MAP } from '../../../../base/src/utils/constants';
import { getRealLatestBlockNumber, resetForkIfPossible } from '../../../../base/test/utils';

/**
 * This script encodes the following transactions:
 * -  Deploys DOLO for networks that don't want to tie the DOLO token to the DolomiteMargin instance (in case of
 *    upgrades)
 */
async function main(): Promise<any> {
  const network = await getAnyNetwork();
  await resetForkIfPossible(await getRealLatestBlockNumber(true, network), network);
  const gnosisSafeAddress = GNOSIS_SAFE_MAP[network];
  const { signer: hhUser1 } = await getDeployerSigner();

  // Deploy new custom token
  const doloAddress = await deployContractAndSave('DOLOWithOwnable', [gnosisSafeAddress], 'DolomiteToken');
  const dolo = DOLOWithOwnable__factory.connect(doloAddress, hhUser1);

  // Push admin transactions
  const transactions: EncodedTransaction[] = [];

  return {
    core: {} as any,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: network,
    },
    invariants: async () => {
      assertHardhatInvariant((await dolo.owner()) === gnosisSafeAddress, 'Invalid DOLO owner');
    },
  };
}

doDryRunAndCheckDeployment(main);
