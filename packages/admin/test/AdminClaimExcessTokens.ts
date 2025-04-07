import { expect } from 'chai';
import { BytesLike } from 'ethers';
import {
  Network,
  ZERO_BI,
} from 'packages/base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import {
  AdminClaimExcessTokens,
  AdminClaimExcessTokens__factory,
  DolomiteOwnerV2,
  DolomiteOwnerV2__factory,
} from '../src/types';
import { disableInterestAccrual, setupCoreProtocol } from 'packages/base/test/utils/setup';
import { revertToSnapshotAndCapture, snapshot, impersonate } from 'packages/base/test/utils';
import { expectProtocolBalance, expectThrow } from 'packages/base/test/utils/assertions';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { createAndUpgradeDolomiteRegistry } from 'packages/base/test/utils/dolomite';

const OTHER_ROLE = '0x1111111111111111111111111111111111111111111111111111111111111111';

describe('AdminClaimExcessTokens', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let dolomiteOwner: DolomiteOwnerV2;
  let bypassTimelockRole: BytesLike;
  let executorRole: BytesLike;

  let adminClaimExcessTokens: AdminClaimExcessTokens;
  let dolomiteOwnerImpersonator: SignerWithAddressWithSafety;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.Berachain,
      blockNumber: 3_389_300
    });
    await disableInterestAccrual(core, core.marketIds.usdc);
    await createAndUpgradeDolomiteRegistry(core);

    dolomiteOwner = DolomiteOwnerV2__factory.connect(await core.dolomiteMargin.owner(), core.gnosisSafe);
    adminClaimExcessTokens = await createContractWithAbi<AdminClaimExcessTokens>(
      AdminClaimExcessTokens__factory.abi,
      AdminClaimExcessTokens__factory.bytecode,
      [core.dolomiteRegistry.address, core.dolomiteMargin.address],
    );

    bypassTimelockRole = await dolomiteOwner.BYPASS_TIMELOCK_ROLE();
    executorRole = await dolomiteOwner.EXECUTOR_ROLE();

    dolomiteOwnerImpersonator = await impersonate(dolomiteOwner.address, true);
    await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRole(OTHER_ROLE);
    await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(OTHER_ROLE, adminClaimExcessTokens.address);
    await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(
      bypassTimelockRole,
      adminClaimExcessTokens.address
    );
    await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(executorRole, adminClaimExcessTokens.address);

    await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRoleToAddressFunctionSelectors(
      OTHER_ROLE,
      core.dolomiteMargin.address,
      [
        '0x8f6bc659' /* ownerWithdrawExcessTokens */,
      ],
    );
    await core.dolomiteMargin.connect(dolomiteOwnerImpersonator).ownerSetGlobalOperator(
      adminClaimExcessTokens.address,
      true
    );
    await core.dolomiteRegistry.connect(dolomiteOwnerImpersonator).ownerSetTreasury(core.gnosisSafe.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await adminClaimExcessTokens.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
      expect(await adminClaimExcessTokens.DOLOMITE_REGISTRY()).to.equal(core.dolomiteRegistry.address);
    });
  });

  describe('#claimExcessTokens', () => {
    it('should work normally to transfer to gnosis safe', async () => {
      const excessTokens = await core.dolomiteMargin.getNumExcessTokens(core.marketIds.usdc);
      await adminClaimExcessTokens.connect(core.gnosisSafe).claimExcessTokens(
        core.tokens.usdc.address,
        false
      );
      expect(await core.tokens.usdc.balanceOf(core.gnosisSafe.address)).to.equal(excessTokens.value);
    });

    it('should work normally to deposit into dolomite margin for dolomite margin owner', async () => {
      const excessTokens = await core.dolomiteMargin.getNumExcessTokens(core.marketIds.usdc);
      await expectProtocolBalance(core, core.gnosisSafe, ZERO_BI, core.marketIds.usdc, ZERO_BI);
      await adminClaimExcessTokens.connect(core.gnosisSafe).claimExcessTokens(
        core.tokens.usdc.address,
        true
      );
      await expectProtocolBalance(core, core.gnosisSafe, ZERO_BI, core.marketIds.usdc, excessTokens.value);
    });

    it('should fail if sender is not treasury', async () => {
      await expectThrow(
        adminClaimExcessTokens.connect(core.hhUser1).claimExcessTokens(
          core.tokens.usdc.address,
          false
        ),
        'AdminClaimExcessTokens: Sender is not treasury'
      );
    });
  });
});
