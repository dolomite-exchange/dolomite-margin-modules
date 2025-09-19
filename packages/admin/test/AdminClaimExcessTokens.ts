import { expect } from 'chai';
import { BytesLike } from 'ethers';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { impersonate, revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectProtocolBalance, expectThrow } from 'packages/base/test/utils/assertions';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { createAdminRegistry } from 'packages/base/test/utils/dolomite';
import { disableInterestAccrual, setupCoreProtocol } from 'packages/base/test/utils/setup';
import { AdminClaimExcessTokens, AdminClaimExcessTokens__factory, AdminRegistry } from '../src/types';

describe('AdminClaimExcessTokens', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let bypassTimelockRole: BytesLike;
  let executorRole: BytesLike;
  let dolomiteOwnerImpersonator: SignerWithAddressWithSafety;

  let adminClaimExcessTokens: AdminClaimExcessTokens;
  let adminRegistry: AdminRegistry;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.Berachain,
      blockNumber: 3_389_300,
    });
    await disableInterestAccrual(core, core.marketIds.usdc);
    adminRegistry = await createAdminRegistry(core);

    adminClaimExcessTokens = await createContractWithAbi<AdminClaimExcessTokens>(
      AdminClaimExcessTokens__factory.abi,
      AdminClaimExcessTokens__factory.bytecode,
      [adminRegistry.address, core.dolomiteMargin.address],
    );

    bypassTimelockRole = await core.ownerAdapterV2.BYPASS_TIMELOCK_ROLE();
    executorRole = await core.ownerAdapterV2.EXECUTOR_ROLE();
    const adminClaimExcessTokensRole = await adminClaimExcessTokens.ADMIN_CLAIM_EXCESS_TOKENS_ROLE();

    dolomiteOwnerImpersonator = await impersonate(core.ownerAdapterV2.address, true);
    await core.ownerAdapterV2.connect(dolomiteOwnerImpersonator).ownerAddRole(adminClaimExcessTokensRole);
    await core.ownerAdapterV2
      .connect(dolomiteOwnerImpersonator)
      .grantRole(adminClaimExcessTokensRole, adminClaimExcessTokens.address);
    await core.ownerAdapterV2
      .connect(dolomiteOwnerImpersonator)
      .grantRole(bypassTimelockRole, adminClaimExcessTokens.address);
    await core.ownerAdapterV2
      .connect(dolomiteOwnerImpersonator)
      .grantRole(executorRole, adminClaimExcessTokens.address);

    await core.ownerAdapterV2
      .connect(dolomiteOwnerImpersonator)
      .ownerAddRoleToAddressFunctionSelectors(adminClaimExcessTokensRole, core.dolomiteMargin.address, [
        core.dolomiteMargin.interface.getSighash(
          core.dolomiteMargin.interface.getFunction('ownerWithdrawExcessTokens'),
        ),
      ]);
    await core.dolomiteMargin
      .connect(dolomiteOwnerImpersonator)
      .ownerSetGlobalOperator(adminClaimExcessTokens.address, true);

    await adminRegistry.connect(core.governance).grantPermission(
      adminClaimExcessTokens.interface.getSighash('claimExcessTokens'),
      adminClaimExcessTokens.address,
      core.hhUser4.address
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await adminClaimExcessTokens.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#claimExcessTokens', () => {
    it('should work normally to transfer to gnosis safe', async () => {
      const excessTokens = await core.dolomiteMargin.getNumExcessTokens(core.marketIds.usdc);
      await adminClaimExcessTokens.connect(core.hhUser4).claimExcessTokens(
        core.tokens.usdc.address,
        core.gnosisSafe.address,
        false
      );
      expect(await core.tokens.usdc.balanceOf(core.gnosisSafe.address)).to.equal(excessTokens.value);
    });

    it('should work normally to deposit into dolomite margin for dolomite margin owner', async () => {
      const excessTokens = await core.dolomiteMargin.getNumExcessTokens(core.marketIds.usdc);
      await expectProtocolBalance(core, core.gnosisSafe, ZERO_BI, core.marketIds.usdc, ZERO_BI);
      await adminClaimExcessTokens.connect(core.hhUser4).claimExcessTokens(
        core.tokens.usdc.address,
        core.gnosisSafe.address,
        true
      );
      await expectProtocolBalance(core, core.gnosisSafe, ZERO_BI, core.marketIds.usdc, excessTokens.value);
    });

    it('should fail if sender does not have permission', async () => {
      await expectThrow(
        adminClaimExcessTokens.connect(core.hhUser1).claimExcessTokens(
          core.tokens.usdc.address,
          core.hhUser1.address,
          false
        ),
        `AdminRegistryHelper: Caller does not have permission <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});
