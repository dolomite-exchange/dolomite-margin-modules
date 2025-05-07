import { IVeArtProxy } from '../src/types';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { Network, ONE_ETH_BI } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber, revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { createVeArt } from './tokenomics-ecosystem-utils';

describe('VeArt', () => {
  let veArt: IVeArtProxy;

  let snapshotId: string;

  before(async () => {
    const network = Network.ArbitrumOne;
    const core = await setupCoreProtocol({
      network,
      blockNumber: await getRealLatestBlockNumber(true, network),
    });
    veArt = await createVeArt();

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#_tokenURI', () => {
    it('should work normally', async () => {
      const endTimestamp = Math.floor(Date.now() / 1000) + (86_400 * 90);
      const votingPower = ONE_ETH_BI.div(2);
      const svg = await veArt._tokenURI(123, votingPower, endTimestamp, ONE_ETH_BI);
      console.log(svg);
    });
  });
});
