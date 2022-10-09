// Utilities
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { IDolomiteMargin } from '../../../src/types';
import { CoreProtocol, setupCoreProtocol } from '../../../src/utils/dolomite-utils';
import { revertToSnapshotAndCapture, snapshot } from '../../../src/utils/utils';

describe('Example', () => {

  let coreProtocol: CoreProtocol;
  let governance: SignerWithAddress;
  let hhUser1: SignerWithAddress;
  let dolomiteMargin: IDolomiteMargin;

  let snapshotId: string;


  before(async () => {
    coreProtocol = await setupCoreProtocol({
      blockNumber: 0,
    });
    governance = coreProtocol.governance;
    hhUser1 = coreProtocol.hhUser1;
    dolomiteMargin = coreProtocol.dolomiteMargin;

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#deployment', () => {
    it('should work properly', async () => {
    });
  });
});
