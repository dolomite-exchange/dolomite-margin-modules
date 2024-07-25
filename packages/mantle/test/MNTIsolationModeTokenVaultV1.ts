import { expect } from 'chai';
import {
  IERC20,
  MNTIsolationModeTokenVaultV1,
  MNTIsolationModeVaultFactory,
  MNTRegistry,
  TestMNTIsolationModeTokenVaultV1,
  TestMNTIsolationModeTokenVaultV1__factory,
} from '../src/types';
import {
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2,
} from '@dolomite-exchange/modules-base/src/types';
import { Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import {
  createMNTIsolationModeVaultFactory,
  createMNTRegistry,
  createMNTUnwrapperTraderV2,
  createMNTWrapperTraderV2,
  createTestMNTIsolationModeTokenVaultV1,
} from './mnt-ecosystem-utils';
import {
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { DEFAULT_BLOCK_NUMBER_FOR_MNT_TESTS } from './mnt-utils';
import { CoreProtocolMantle } from '@dolomite-exchange/modules-base/test/utils/core-protocols/core-protocol-mantle';
import { parseEther } from 'ethers/lib/utils';
import {
  expectProtocolBalance,
  expectThrow,
  expectTotalSupply,
  expectWalletBalance,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import { BigNumber } from 'ethers';

const amountWei = parseEther('1');
const defaultAccountNumber = 0;

describe('MNTIsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocolMantle;
  let mntRegistry: MNTRegistry;
  let unwrapper: SimpleIsolationModeUnwrapperTraderV2;
  let wrapper: SimpleIsolationModeWrapperTraderV2;
  let mntFactory: MNTIsolationModeVaultFactory;
  let isolationModeMarketId: BigNumber;
  let mntVault: TestMNTIsolationModeTokenVaultV1;
  let underlyingToken: IERC20;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: DEFAULT_BLOCK_NUMBER_FOR_MNT_TESTS,
      network: Network.Mantle,
    });

    mntRegistry = await createMNTRegistry(core);

    underlyingToken = core.tokens.wmnt;
    const vaultImplementation = await createTestMNTIsolationModeTokenVaultV1();
    mntFactory = await createMNTIsolationModeVaultFactory(mntRegistry, vaultImplementation, core);

    unwrapper = await createMNTUnwrapperTraderV2(mntFactory, core);
    wrapper = await createMNTWrapperTraderV2(mntFactory, core);

    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
      token: mntFactory.address,
      decimals: 18,
      oracleInfos: await core.oracleAggregatorV2.getOraclesByToken(core.tokens.wmnt.address),
    });
    await core.chroniclePriceOracleV3
      .connect(core.governance)
      .ownerInsertOrUpdateOracleToken(
        mntFactory.address,
        await core.chroniclePriceOracleV3.getScribeByToken(core.tokens.wmnt.address),
        false,
      );

    await setupTestMarket(core, mntFactory, true, core.oracleAggregatorV2);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(mntFactory.address, true);
    await mntFactory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    isolationModeMarketId = await core.dolomiteMargin.getMarketIdByTokenAddress(mntFactory.address);

    await mntFactory.createVault(core.hhUser1.address);
    mntVault = setupUserVaultProxy<TestMNTIsolationModeTokenVaultV1>(
      await mntFactory.getVaultByAccount(core.hhUser1.address),
      TestMNTIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#receive', () => {
    it('should fail if funds are blind transferred in', async () => {
      await expectThrow(
        core.hhUser1.sendTransaction({
          to: mntVault.address,
          value: amountWei,
        }),
        `MNTIsolationModeTokenVaultV1: Invalid currency sender <${core.hhUser1.addressLower}>`,
      );
    });
  });

  describe('#depositPayableIntoVaultForDolomiteMargin', () => {
    it('should work normally', async () => {
      await mntVault.depositPayableIntoVaultForDolomiteMargin(defaultAccountNumber, { value: amountWei });

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, mntVault, defaultAccountNumber, isolationModeMarketId, amountWei);

      await expectWalletBalance(core.dolomiteMargin, mntFactory, amountWei);
      await expectWalletBalance(mntVault, underlyingToken, amountWei);

      await expectTotalSupply(mntFactory, amountWei);
    });

    it('should fail when reentrancy is triggered', async () => {
      const tx = await mntVault.populateTransaction.depositPayableIntoVaultForDolomiteMargin(defaultAccountNumber);
      await expectThrow(
        mntVault.testReentrancyOnOtherFunction(tx.data!),
        'IsolationModeTokenVaultV1: Reentrant call',
      );
    });

    it('should fail when toAccountNumber is not 0', async () => {
      await expectThrow(
        mntVault.depositPayableIntoVaultForDolomiteMargin('1'),
        'IsolationModeVaultV1ActionsImpl: Invalid toAccountNumber <1>',
      );
    });

    it('should fail when not sent by vault owner nor factory', async () => {
      await expectThrow(
        mntVault.connect(core.hhUser2).depositPayableIntoVaultForDolomiteMargin(defaultAccountNumber),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.addressLower}>`,
      );
      const factoryImpersonator = await impersonate(mntFactory.address, true);
      await expectThrow(
        mntVault.connect(factoryImpersonator).depositPayableIntoVaultForDolomiteMargin(defaultAccountNumber),
        `IsolationModeTokenVaultV1: Only owner can call <${factoryImpersonator.addressLower}>`,
      );
    });
  });

  describe('#withdrawPayableFromVaultForDolomiteMargin', () => {
    it('should work normally', async () => {
      await mntVault.depositPayableIntoVaultForDolomiteMargin(defaultAccountNumber);
      await mntVault.withdrawPayableFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, mntVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);

      await expectWalletBalance(core.dolomiteMargin, mntFactory, ZERO_BI);
      await expectWalletBalance(mntVault, underlyingToken, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);

      await expectTotalSupply(mntFactory, ZERO_BI);
    });

    it('should fail when reentrancy is triggered', async () => {
      const tx = await mntVault.populateTransaction.withdrawPayableFromVaultForDolomiteMargin(
        defaultAccountNumber,
        amountWei,
      );
      await expectThrow(
        mntVault.testReentrancyOnOtherFunction(tx.data!),
        'IsolationModeTokenVaultV1: Reentrant call',
      );
    });

    it('should fail when fromAccountNumber is not 0', async () => {
      await expectThrow(
        mntVault.withdrawPayableFromVaultForDolomiteMargin('1', amountWei),
        'IsolationModeVaultV1ActionsImpl: Invalid fromAccountNumber <1>',
      );
    });

    it('should fail when not sent by vault owner nor factory', async () => {
      await expectThrow(
        mntVault.connect(core.hhUser2).withdrawPayableFromVaultForDolomiteMargin(defaultAccountNumber, amountWei),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#dolomiteRegistry', () => {
    it('should work', async () => {
      expect(await mntVault.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });
  });

  describe('#registry', () => {
    it('should work', async () => {
      expect(await mntVault.registry()).to.equal(mntRegistry.address);
    });
  });
});
