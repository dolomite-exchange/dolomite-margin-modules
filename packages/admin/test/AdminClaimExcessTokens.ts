import { expect } from 'chai';
import { BytesLike } from 'ethers';
import {
  ADDRESS_ZERO,
  BYTES_EMPTY,
  BYTES_ZERO,
  Network,
  ONE_DAY_SECONDS,
} from 'packages/base/src/utils/no-deps-constants';
import { Ownable__factory } from 'packages/liquidity-mining/src/types';

import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { AdminClaimExcessTokens, AdminClaimExcessTokens__factory, DolomiteOwnerV2 } from '../src/types';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { createDolomiteOwnerV2 } from './admin-ecosystem-utils';
import { disableInterestAccrual, getDefaultCoreProtocolConfig, setupCoreProtocol } from 'packages/base/test/utils/setup';
import { revertToSnapshotAndCapture, snapshot, impersonate } from 'packages/base/test/utils';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const OTHER_ROLE = '0x1111111111111111111111111111111111111111111111111111111111111111';
const BAD_ROLE = '0x8888888888888888888888888888888888888888888888888888888888888888';
const BYTES4_OTHER_SELECTOR = '0x12345678';
const BYTES32_OTHER_SELECTOR = '0x1234567800000000000000000000000000000000000000000000000000000000';
const SECONDS_TIME_LOCKED = ONE_DAY_SECONDS;

describe('AdminClaimExcessTokens', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;

  let dolomiteOwner: DolomiteOwnerV2;
  let adminClaimExcessTokens: AdminClaimExcessTokens;

  let bypassTimelockRole: BytesLike;
  let executorRole: BytesLike;
  let securityCouncilRole: BytesLike;
  let listingCommitteeRole: BytesLike;

  let dolomiteOwnerImpersonator: SignerWithAddressWithSafety;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    await disableInterestAccrual(core, core.marketIds.usdc);

    dolomiteOwner = (await createDolomiteOwnerV2(core, SECONDS_TIME_LOCKED)).connect(core.gnosisSafe);
    adminClaimExcessTokens = await createContractWithAbi<AdminClaimExcessTokens>(
      AdminClaimExcessTokens__factory.abi,
      AdminClaimExcessTokens__factory.bytecode,
      [core.gnosisSafe.address, core.depositWithdrawalRouter.address, core.dolomiteMargin.address],
    );

    bypassTimelockRole = await dolomiteOwner.BYPASS_TIMELOCK_ROLE();
    executorRole = await dolomiteOwner.EXECUTOR_ROLE();
    securityCouncilRole = await dolomiteOwner.SECURITY_COUNCIL_ROLE();
    listingCommitteeRole = await dolomiteOwner.LISTING_COMMITTEE_ROLE();
    const ownable = Ownable__factory.connect(core.dolomiteMargin.address, core.governance);
    await ownable.transferOwnership(dolomiteOwner.address);

    dolomiteOwnerImpersonator = await impersonate(dolomiteOwner.address, true);
    await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRole(OTHER_ROLE);
    await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(OTHER_ROLE, adminClaimExcessTokens.address);
    await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(bypassTimelockRole, adminClaimExcessTokens.address);
    await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(executorRole, adminClaimExcessTokens.address);

    await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRoleToAddressFunctionSelectors(
      OTHER_ROLE,
      core.dolomiteMargin.address,
      [
        '0x8f6bc659' /* ownerWithdrawExcessTokens */,
      ],
    );
    await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRoleToAddressFunctionSelectors(
      OTHER_ROLE,
      core.depositWithdrawalRouter.address,
      [
        '0xb6f32e03' /* depositWei */,
      ],
    );
    await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRoleFunctionSelectors(
      OTHER_ROLE,
      [
        '0x095ea7b3' /* approve */,
      ],
    );
    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await adminClaimExcessTokens.owner()).to.equal(core.gnosisSafe.address);
      expect(await adminClaimExcessTokens.DEPOSIT_WITHDRAWAL_ROUTER()).to.equal(core.depositWithdrawalRouter.address);
      expect(await adminClaimExcessTokens.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe.only('#claimExcessTokens', () => {
    it('should work normally to transfer to gnosis safe', async () => {
      console.log(await core.dolomiteMargin.getNumExcessTokens(core.marketIds.usdc));
      await adminClaimExcessTokens.connect(core.gnosisSafe).claimExcessTokens(
        core.tokens.usdc.address,
        adminClaimExcessTokens.address
      );
      console.log(await core.tokens.usdc.balanceOf(core.gnosisSafe.address));
    });

    it('should work normally to deposit into dolomite margin for dolomite margin owner', async () => {

    });
  });
});
