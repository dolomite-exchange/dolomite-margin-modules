import { expect } from 'chai';
import { OARB, OARBStorageVault, OARBStorageVault__factory, OARB__factory } from 'src/types';
import { createContractWithAbi } from 'src/utils/dolomite-utils';
import { Network, ONE_ETH_BI, ZERO_BI } from 'src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'test/utils';
import { expectThrow } from 'test/utils/assertions';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from 'test/utils/setup';

describe('OARBStorageVault', () => {
  let snapshotId: string;
  let core: CoreProtocol;
  let oARB: OARB;
  let oARBStorageVault: OARBStorageVault;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    oARB = await createContractWithAbi<OARB>(
        OARB__factory.abi,
        OARB__factory.bytecode,
        [core.dolomiteMargin.address]
    );
    oARBStorageVault = await createContractWithAbi<OARBStorageVault>(
        OARBStorageVault__factory.abi,
        OARBStorageVault__factory.bytecode,
        [core.dolomiteMargin.address, oARB.address],
    );
    await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
    await core.dolomiteMargin.ownerSetGlobalOperator(oARBStorageVault.address, true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await oARBStorageVault.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await oARBStorageVault.oARB()).to.eq(oARB.address);
    });
  });

  describe('#pullTokensFromVault', () => {
    it('should work normally', async () => {
      expect(await oARB.balanceOf(core.hhUser5.address)).to.eq(ZERO_BI);
      await oARBStorageVault.connect(core.hhUser5).pullTokensFromVault(ONE_ETH_BI);
      expect(await oARB.balanceOf(core.hhUser5.address)).to.eq(ONE_ETH_BI);
    });

    it('should fail if not called by operator', async () => {
      await expectThrow(
        oARBStorageVault.connect(core.hhUser1).pullTokensFromVault(ONE_ETH_BI),
        `OnlyDolomiteMargin: Caller is not a global operator <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });
});
