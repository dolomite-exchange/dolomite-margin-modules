import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { parseEther } from 'ethers/lib/utils';
import { BigNumber } from 'ethers';
import { D_ARB_MAP } from 'packages/base/src/utils/constants';
import { ARBIsolationModeTokenVaultV1__factory } from 'packages/arb/src/types';

const ARB_VAULT = '0x63cE15c9284AD87eD8A9E56e689B6479Bb652489';
const ARB_AMOUNT = parseEther('364.108677');
const USDC_AMOUNT = BigNumber.from('88566586');

/**
 * This script encodes the following transactions:
 * - Deploys the new ARB token vault
 * - Calls owner recover token to recover ARB and USDC from the vault
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await core.deployedVaultsMap[D_ARB_MAP[network].marketId].deployNewVaultAndEncodeUpgradeTransaction(core, {})
  );

  const arbVault = ARBIsolationModeTokenVaultV1__factory.connect(ARB_VAULT, core.governance);
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { arbVault: arbVault },
      'arbVault',
      'ownerRecoverToken',
      [core.tokens.arb.address, ARB_AMOUNT],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { arbVault: arbVault },
      'arbVault',
      'ownerRecoverToken',
      [core.tokens.nativeUsdc.address, USDC_AMOUNT],
    ),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
    },
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);
