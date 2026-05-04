import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { BigNumber, BytesLike } from 'ethers';
import { ExpirePositionProxy, ExpirePositionProxy__factory } from 'packages/base/src/types';
import {
  createContractWithAbi,
  depositIntoDolomiteMargin,
} from 'packages/base/src/utils/dolomite-utils';
import { Network, ONE_ETH_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { AccountInfoStruct } from 'packages/base/src/utils';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectThrow } from 'packages/base/test/utils/assertions';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { createAdminRegistry } from 'packages/base/test/utils/dolomite';
import { disableInterestAccrual, setupCoreProtocol, setupWETHBalance } from 'packages/base/test/utils/setup';
import { AdminExpirePosition, AdminExpirePosition__factory, AdminRegistry } from '../src/types';

const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = BigNumber.from('123');
const usdcAmount = BigNumber.from('100000000');
const expirationTimestamp = BigNumber.from('1777900000');

describe('AdminExpirePosition', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;

  let expirePositionProxy: ExpirePositionProxy;
  let adminExpirePosition: AdminExpirePosition;
  let adminRegistry: AdminRegistry;

  let bypassTimelockRole: BytesLike;
  let executorRole: BytesLike;

  let account1: AccountInfoStruct;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 459_300_000,
    });

    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.usdc);
    await disableInterestAccrual(core, core.marketIds.dai);

    expirePositionProxy = await createContractWithAbi<ExpirePositionProxy>(
      ExpirePositionProxy__factory.abi,
      ExpirePositionProxy__factory.bytecode,
      [core.expiry.address, core.dolomiteMargin.address],
    );

    adminRegistry = await createAdminRegistry(core);

    adminExpirePosition = await createContractWithAbi<AdminExpirePosition>(
      AdminExpirePosition__factory.abi,
      AdminExpirePosition__factory.bytecode,
      [expirePositionProxy.address, adminRegistry.address, core.dolomiteMargin.address],
    );

    bypassTimelockRole = await core.ownerAdapterV2.BYPASS_TIMELOCK_ROLE();
    executorRole = await core.ownerAdapterV2.EXECUTOR_ROLE();
    const adminExpirePositionRole = await adminExpirePosition.ADMIN_EXPIRE_POSITION_ROLE();

    await core.ownerAdapterV2.connect(core.governance).ownerAddRole(adminExpirePositionRole);
    await core.ownerAdapterV2
      .connect(core.governance)
      .grantRole(adminExpirePositionRole, adminExpirePosition.address);
    await core.ownerAdapterV2
      .connect(core.governance)
      .grantRole(bypassTimelockRole, adminExpirePosition.address);
    await core.ownerAdapterV2
      .connect(core.governance)
      .grantRole(executorRole, adminExpirePosition.address);
    await core.ownerAdapterV2
      .connect(core.governance)
      .ownerAddRoleAddresses(adminExpirePositionRole, [expirePositionProxy.address]);

    await core.dolomiteMargin
      .connect(core.governance)
      .ownerSetGlobalOperator(expirePositionProxy.address, true);

    await adminRegistry.connect(core.governance).grantPermission(
      adminExpirePosition.interface.getSighash('expirePositions'),
      adminExpirePosition.address,
      core.gnosisSafe.address,
    );

    await setupWETHBalance(core, core.hhUser1, ONE_ETH_BI, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, ONE_ETH_BI);
    await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
      borrowAccountNumber,
      defaultAccountNumber,
      core.marketIds.usdc,
      usdcAmount,
      BalanceCheckFlag.None,
    );
    account1 = { owner: core.hhUser1.address, number: borrowAccountNumber };

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await adminExpirePosition.EXPIRE_POSITION_PROXY()).to.equal(expirePositionProxy.address);
      expect(await adminExpirePosition.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
      expect(await adminExpirePosition.ADMIN_REGISTRY()).to.equal(adminRegistry.address);
    });
  });

  describe('#expirePositions', () => {
    it('should work normally', async () => {
      const positions = [
        {
          expirationTimestamp,
          account: account1,
          owedMarkets: [core.marketIds.usdc],
        },
      ];
      await adminExpirePosition.connect(core.gnosisSafe).expirePositions(positions);

      expect(await core.expiry.getExpiry(account1, core.marketIds.usdc)).to.eq(expirationTimestamp);
    });

    it('should fail if caller does not have permission', async () => {
      const positions = [
        {
          expirationTimestamp,
          account: account1,
          owedMarkets: [core.marketIds.usdc],
        },
      ];
      await expectThrow(
        adminExpirePosition.connect(core.hhUser1).expirePositions(positions),
        `AdminRegistryHelper: Caller does not have permission <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });
});
