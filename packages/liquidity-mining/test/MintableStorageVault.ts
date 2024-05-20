import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_ETH_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { OARB, MintableStorageVault, MintableStorageVault__factory } from '../src/types';
import { createOARB } from './liquidity-mining-ecosystem-utils';

// OARB Storage Vault contract is not in use in production. These tests don't all pass
xdescribe('MintableStorageVault', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let oARB: OARB;
  let oARBStorageVault: MintableStorageVault;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    oARB = await createOARB(core);
    oARBStorageVault = await createContractWithAbi<MintableStorageVault>(
      MintableStorageVault__factory.abi,
      MintableStorageVault__factory.bytecode,
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
        `OnlyDolomiteMargin: Caller is not a global operator <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});
