import { expect } from 'chai';
import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

const OLD_MINT_BURN_CCIP_POOL = '0xFd8008cC03c0963C6Da4d135f919C57e15696D92';
const NEW_MINT_BURN_CCIP_POOL = '0x9E7728077F753dFDF53C2236097E27C743890992';

/**
 * This script encodes the following transactions:
 * - Minters for DOLO for CCIP
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(core, { dolo: core.tokenomics.dolo }, 'dolo', 'ownerSetMinter', [
      OLD_MINT_BURN_CCIP_POOL,
      false,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, { dolo: core.tokenomics.dolo }, 'dolo', 'ownerSetMinter', [
      NEW_MINT_BURN_CCIP_POOL,
      true,
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
      expect(await core.tokenomics.dolo.isMinter(OLD_MINT_BURN_CCIP_POOL)).to.be.false;
      expect(await core.tokenomics.dolo.isMinter(NEW_MINT_BURN_CCIP_POOL)).to.be.true;
    },
  };
}

doDryRunAndCheckDeployment(main);
