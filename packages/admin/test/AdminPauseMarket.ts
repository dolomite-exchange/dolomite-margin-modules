import { expect } from 'chai';
import { BigNumber, BytesLike } from 'ethers';
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
import { AdminClaimExcessTokens, AdminClaimExcessTokens__factory, AdminPauseMarket, AdminPauseMarket__factory, DolomiteOwnerV2 } from '../src/types';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { createDolomiteOwnerV2 } from './admin-ecosystem-utils';
import { disableInterestAccrual, getDefaultCoreProtocolConfig, setupCoreProtocol, setupUSDCBalance, setupWETHBalance } from 'packages/base/test/utils/setup';
import { revertToSnapshotAndCapture, snapshot, impersonate } from 'packages/base/test/utils';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';
import { createContractWithAbi, depositIntoDolomiteMargin, withdrawFromDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const OTHER_ROLE = '0x1111111111111111111111111111111111111111111111111111111111111111';
const BAD_ROLE = '0x8888888888888888888888888888888888888888888888888888888888888888';
const BYTES4_OTHER_SELECTOR = '0x12345678';
const BYTES32_OTHER_SELECTOR = '0x1234567800000000000000000000000000000000000000000000000000000000';
const SECONDS_TIME_LOCKED = ONE_DAY_SECONDS;

const usdcAmount = BigNumber.from('10000000'); // 10 USDC

describe('AdminPauseMarket', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;

  let dolomiteOwner: DolomiteOwnerV2;
  let adminPauseMarket: AdminPauseMarket;

  let bypassTimelockRole: BytesLike;
  let executorRole: BytesLike;
  let securityCouncilRole: BytesLike;
  let listingCommitteeRole: BytesLike;

  let dolomiteOwnerImpersonator: SignerWithAddressWithSafety;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    await disableInterestAccrual(core, core.marketIds.usdc);

    dolomiteOwner = (await createDolomiteOwnerV2(core, SECONDS_TIME_LOCKED)).connect(core.gnosisSafe);
    adminPauseMarket = await createContractWithAbi<AdminPauseMarket>(
      AdminPauseMarket__factory.abi,
      AdminPauseMarket__factory.bytecode,
      [core.gnosisSafe.address, core.oracleAggregatorV2.address, core.dolomiteMargin.address],
    );

    bypassTimelockRole = await dolomiteOwner.BYPASS_TIMELOCK_ROLE();
    executorRole = await dolomiteOwner.EXECUTOR_ROLE();
    securityCouncilRole = await dolomiteOwner.SECURITY_COUNCIL_ROLE();
    listingCommitteeRole = await dolomiteOwner.LISTING_COMMITTEE_ROLE();
    const ownable = Ownable__factory.connect(core.dolomiteMargin.address, core.governance);
    await ownable.transferOwnership(dolomiteOwner.address);

    dolomiteOwnerImpersonator = await impersonate(dolomiteOwner.address, true);
    await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRole(OTHER_ROLE);
    await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(OTHER_ROLE, adminPauseMarket.address);
    await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(bypassTimelockRole, adminPauseMarket.address);
    await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(executorRole, adminPauseMarket.address);

    await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRoleToAddressFunctionSelectors(
      OTHER_ROLE,
      core.dolomiteMargin.address,
      [
        '0xe8e72f75' /* ownerSetPriceOracle */,
      ],
    );
    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await adminPauseMarket.owner()).to.equal(core.gnosisSafe.address);
      expect(await adminPauseMarket.ORACLE_AGGREGATOR()).to.equal(core.oracleAggregatorV2.address);
      expect(await adminPauseMarket.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe.only('#pauseMarket', () => {
    it('should work normally to pause a market', async () => {
      await setupUSDCBalance(core, core.hhUser1, usdcAmount.mul(2), core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdcAmount);

      await adminPauseMarket.connect(core.gnosisSafe).pauseMarket(core.marketIds.usdc);
      await expectThrow(
        depositIntoDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdcAmount),
        'Storage: Price cannot be zero <2>'
      );
      await expectThrow(
        withdrawFromDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdcAmount),
        'Storage: Price cannot be zero <2>'
      );

      await adminPauseMarket.connect(core.gnosisSafe).unpauseMarket(core.marketIds.usdc, core.oracleAggregatorV2.address);
      await withdrawFromDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdcAmount);
    });
  });
});
