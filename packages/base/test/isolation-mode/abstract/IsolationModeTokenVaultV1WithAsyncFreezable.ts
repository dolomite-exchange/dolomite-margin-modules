import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin/dist/src';
import { GenericTraderType } from '@dolomite-exchange/zap-sdk';
import { GenericEventEmissionType } from '@dolomite-margin/dist/src/modules/GenericTraderProxyV1';
import { expect } from 'chai';
import { BigNumber, BigNumberish, ContractTransaction } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import {
  CustomTestToken,
  DepositWithdrawalRouter,
  DepositWithdrawalRouter__factory,
  RouterProxy__factory,
  TestAsyncFreezableIsolationModeVaultFactory,
  TestHandlerRegistry,
  TestIsolationModeTokenVaultV1WithAsyncFreezable,
  TestIsolationModeTokenVaultV1WithAsyncFreezable__factory,
  TestIsolationModeUnwrapperTraderV2,
  TestIsolationModeUnwrapperTraderV2__factory,
  TestIsolationModeWrapperTraderV2,
  TestIsolationModeWrapperTraderV2__factory,
} from '../../../src/types';
import {
  createContractWithAbi,
  createContractWithLibrary,
  createContractWithName,
  createTestToken,
  depositIntoDolomiteMargin,
  withdrawFromDolomiteMargin,
} from '../../../src/utils/dolomite-utils';
import {
  ADDRESS_ZERO,
  BYTES_EMPTY,
  MAX_UINT_256_BI,
  Network,
  ONE_BI,
  ONE_ETH_BI,
  ZERO_BI,
} from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectThrow,
  expectTotalSupply,
  expectWalletBalance,
} from '../../utils/assertions';

import { CoreProtocolArbitrumOne } from '../../utils/core-protocols/core-protocol-arbitrum-one';
import {
  createAndUpgradeDolomiteRegistry,
  createAsyncIsolationModeTokenVaultV1ActionsImpl,
  createIsolationModeTokenVaultV1ActionsImpl,
} from '../../utils/dolomite';
import {
  createTestAsyncFreezableIsolationModeVaultFactory,
  createTestHandlerRegistry,
} from '../../utils/ecosystem-utils/testers';
import { setupCoreProtocol, setupTestMarket, setupUserVaultProxy } from '../../utils/setup';
import { getSimpleZapParams, getUnwrapZapParams, getWrapZapParams } from '../../utils/zap-utils';

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10
const usdcAmount = BigNumber.from('100000000'); // $100
const bigOtherAmountWei = BigNumber.from('100000000000'); // $100,000

enum FreezeType {
  Deposit = 0,
  Withdrawal = 1,
}

const PLUS_ONE_BI = {
  sign: true,
  value: ONE_BI,
};

const EXECUTION_FEE = ONE_ETH_BI.div(4);

describe('IsolationModeTokenVaultV1WithAsyncFreezable', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: CustomTestToken;
  let underlyingMarketId: BigNumber;
  let tokenUnwrapper: TestIsolationModeUnwrapperTraderV2;
  let tokenWrapper: TestIsolationModeWrapperTraderV2;
  let factory: TestAsyncFreezableIsolationModeVaultFactory;
  let userVaultImplementation: TestIsolationModeTokenVaultV1WithAsyncFreezable;
  let userVault: TestIsolationModeTokenVaultV1WithAsyncFreezable;
  let impersonatedVault: SignerWithAddressWithSafety;
  let impersonatedUnwrapper: SignerWithAddressWithSafety;
  let registry: TestHandlerRegistry;

  let solidUser: SignerWithAddressWithSafety;
  let otherToken1: CustomTestToken;
  let otherToken2: CustomTestToken;
  let otherMarketId1: BigNumber;
  let otherMarketId2: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 326_681_400,
      network: Network.ArbitrumOne,
    });
    await createAndUpgradeDolomiteRegistry(core);
    const genericTraderLib = await createContractWithName('GenericTraderProxyV2Lib', []);
    const genericTraderProxy = await createContractWithLibrary(
      'GenericTraderProxyV2',
      { GenericTraderProxyV2Lib: genericTraderLib.address },
      [core.dolomiteRegistry.address, core.dolomiteMargin.address],
    );
    await core.dolomiteRegistry.ownerSetGenericTraderProxy(genericTraderProxy.address);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(genericTraderProxy.address, true);

    const newDepositWithdrawalRouter = await createContractWithAbi<DepositWithdrawalRouter>(
      DepositWithdrawalRouter__factory.abi,
      DepositWithdrawalRouter__factory.bytecode,
      [core.dolomiteRegistry.address, core.dolomiteMargin.address],
    );
    const routerProxy = RouterProxy__factory.connect(core.depositWithdrawalRouter.address, core.hhUser1);
    await routerProxy.connect(core.governance).upgradeTo(newDepositWithdrawalRouter.address);

    underlyingToken = await createTestToken();
    const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
    const asyncLib = await createAsyncIsolationModeTokenVaultV1ActionsImpl();
    userVaultImplementation = await createContractWithLibrary<TestIsolationModeTokenVaultV1WithAsyncFreezable>(
      'TestIsolationModeTokenVaultV1WithAsyncFreezable',
      { ...libraries, ...asyncLib },
      [core.tokens.weth.address, core.network],
    );
    registry = await createTestHandlerRegistry(core);
    factory = await createTestAsyncFreezableIsolationModeVaultFactory(
      EXECUTION_FEE,
      registry,
      core,
      underlyingToken,
      userVaultImplementation,
    );
    await core.testEcosystem!.testPriceOracle.setPrice(
      factory.address,
      '1000000000000000000', // $1.00
    );

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);

    solidUser = core.hhUser5;

    otherToken1 = await createTestToken();
    await core.testEcosystem!.testPriceOracle.setPrice(
      otherToken1.address,
      '1000000000000000000000000000000', // $1.00 in USDC
    );
    otherMarketId1 = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken1, false);

    otherToken2 = await createTestToken();
    await core.testEcosystem!.testPriceOracle.setPrice(
      otherToken2.address,
      '1000000000000000000000000000000', // $1.00 in USDC
    );
    otherMarketId2 = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken2, false);

    tokenUnwrapper = await createContractWithAbi(
      TestIsolationModeUnwrapperTraderV2__factory.abi,
      TestIsolationModeUnwrapperTraderV2__factory.bytecode,
      [otherToken1.address, factory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address],
    );
    tokenWrapper = await createContractWithAbi(
      TestIsolationModeWrapperTraderV2__factory.abi,
      TestIsolationModeWrapperTraderV2__factory.bytecode,
      [otherToken1.address, factory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address],
    );
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.connect(core.governance).ownerInitialize(
      [
        tokenUnwrapper.address,
        tokenWrapper.address,
        core.depositWithdrawalRouter.address,
      ],
    );
    await factory.connect(core.governance).ownerSetExecutionFee(ZERO_BI);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    userVault = setupUserVaultProxy<TestIsolationModeTokenVaultV1WithAsyncFreezable>(
      vaultAddress,
      TestIsolationModeTokenVaultV1WithAsyncFreezable__factory,
      core.hhUser1,
    );

    await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
    await underlyingToken.connect(core.hhUser1).approve(vaultAddress, amountWei);

    await otherToken1.connect(core.hhUser1).addBalance(core.hhUser1.address, otherAmountWei);
    await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, otherAmountWei);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);

    await otherToken1.connect(solidUser).addBalance(solidUser.address, bigOtherAmountWei);
    await otherToken1.connect(solidUser).approve(core.dolomiteMargin.address, bigOtherAmountWei);
    await depositIntoDolomiteMargin(core, solidUser, defaultAccountNumber, otherMarketId1, bigOtherAmountWei);

    await otherToken2.connect(core.hhUser1).addBalance(core.hhUser1.address, otherAmountWei);
    await otherToken2.connect(core.hhUser1).approve(core.dolomiteMargin.address, otherAmountWei);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);

    await otherToken2.connect(solidUser).addBalance(solidUser.address, bigOtherAmountWei);
    await otherToken2.connect(solidUser).approve(core.dolomiteMargin.address, bigOtherAmountWei);
    await depositIntoDolomiteMargin(core, solidUser, defaultAccountNumber, otherMarketId2, bigOtherAmountWei);

    impersonatedVault = await impersonate(userVault.address, true);
    impersonatedUnwrapper = await impersonate(tokenUnwrapper.address, true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  async function freezeVault(
    accountNumber: BigNumberish = ZERO_BI,
  ): Promise<ContractTransaction> {
    return factory.connect(impersonatedVault).setVaultAccountPendingAmountForFrozenStatus(
      userVault.address,
      accountNumber,
      FreezeType.Deposit,
      PLUS_ONE_BI,
      core.tokens.usdc.address,
    );
  }

  describe('basic read functions', () => {
    it('should work', async () => {
      expect(await userVault.UNDERLYING_TOKEN()).to.eq(underlyingToken.address);
      expect(await userVault.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await userVault.BORROW_POSITION_PROXY()).to.eq(core.borrowPositionProxyV2.address);
      expect(await userVault.VAULT_FACTORY()).to.eq(factory.address);
      expect(await userVault.marketId()).to.eq(underlyingMarketId);
      expect(await userVault.isDepositSourceWrapper()).to.eq(false);
      expect(await userVault.shouldSkipTransfer()).to.eq(false);

      expect(await userVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await userVault.underlyingBalanceOf()).to.eq(amountWei);
    });
  });

  describe('#initialize', () => {
    it('should fail when already initialized', async () => {
      await expectThrow(
        userVault.initialize(),
        'IsolationModeTokenVaultV1: Already initialized',
      );
    });
  });

  describe('#depositIntoVaultForDolomiteMargin', () => {
    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, amountWei);

      await expectWalletBalance(core.dolomiteMargin, factory, amountWei);
      await expectWalletBalance(userVault, underlyingToken, amountWei);

      await expectTotalSupply(factory, amountWei);
    });

    it('should work normally when other sub-account is frozen', async () => {
      await freezeVault(ONE_BI);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, amountWei);

      await expectWalletBalance(core.dolomiteMargin, factory, amountWei);
      await expectWalletBalance(userVault, underlyingToken, amountWei);

      await expectTotalSupply(factory, amountWei);
    });

    it('should work when interacted with via factory', async () => {
      const factorySigner = await impersonate(factory.address, true);
      await userVault.connect(factorySigner).depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, amountWei);

      await expectWalletBalance(core.dolomiteMargin, factory, amountWei);
      await expectWalletBalance(userVault, underlyingToken, amountWei);
      await expectWalletBalance(core.hhUser1, underlyingToken, ZERO_BI);

      await expectTotalSupply(factory, amountWei);
    });

    it('should fail when toAccountNumber is not 0', async () => {
      await expectThrow(
        userVault.depositIntoVaultForDolomiteMargin('1', amountWei),
        'IsolationModeVaultV1ActionsImpl: Invalid toAccountNumber <1>',
      );
    });

    it('should fail when not sent by vault owner nor factory', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei),
        `IsolationModeTokenVaultV1: Only owner or factory can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail if sub-account is frozen', async () => {
      await freezeVault();
      await expectThrow(
        userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei),
        `IsolationVaultV1AsyncFreezable: Vault account is frozen <${defaultAccountNumber}>`,
      );
    });

    it('should fail through router if sub-account is frozen', async () => {
      await underlyingToken.connect(core.hhUser1).approve(core.depositWithdrawalRouter.address, amountWei);

      await freezeVault();
      await expectThrow(
        core.depositWithdrawalRouter.connect(core.hhUser1).depositWei(
          underlyingMarketId,
          defaultAccountNumber,
          underlyingMarketId,
          amountWei,
          0,
        ),
        `IsolationVaultV1AsyncFreezable: Vault account is frozen <${defaultAccountNumber}>`,
      );
    });
  });

  describe('#withdrawFromVaultForDolomiteMargin', () => {
    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);

      await expectWalletBalance(core.dolomiteMargin, factory, ZERO_BI);
      await expectWalletBalance(userVault, underlyingToken, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);

      await expectTotalSupply(factory, ZERO_BI);
    });

    it('should work normally if other sub-account is frozen', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await freezeVault(ONE_BI);
      await userVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);

      await expectWalletBalance(core.dolomiteMargin, factory, ZERO_BI);
      await expectWalletBalance(userVault, underlyingToken, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);

      await expectTotalSupply(factory, ZERO_BI);
    });

    it('should fail when fromAccountNumber is not 0', async () => {
      await expectThrow(
        userVault.withdrawFromVaultForDolomiteMargin('1', amountWei),
        'IsolationModeVaultV1ActionsImpl: Invalid fromAccountNumber <1>',
      );
    });

    it('should fail when not sent by vault owner nor factory', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail if vault sub-account is frozen', async () => {
      await freezeVault();
      await expectThrow(
        userVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei),
        `IsolationVaultV1AsyncFreezable: Vault account is frozen <${defaultAccountNumber}>`,
      );
    });

    it('should fail through router if vault sub-account is frozen', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await freezeVault();
      await expectThrow(
        core.depositWithdrawalRouter.connect(core.hhUser1).withdrawWei(
          underlyingMarketId,
          defaultAccountNumber,
          underlyingMarketId,
          amountWei,
          0,
        ),
        `IsolationVaultV1AsyncFreezable: Vault account is frozen <${defaultAccountNumber}>`,
      );
    });
  });

  describe('#openBorrowPosition', () => {
    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, amountWei);
    });

    it('should fail when not called by owner or converter', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei),
        `IsolationModeTokenVaultV1: Only owner or converter can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when fromAccountNumber != 0', async () => {
      await expectThrow(
        userVault.openBorrowPosition(borrowAccountNumber, defaultAccountNumber, amountWei),
        `IsolationModeVaultV1ActionsImpl: Invalid fromAccountNumber <${borrowAccountNumber}>`,
      );
    });

    it('should fail when toAccountNumber == 0', async () => {
      await expectThrow(
        userVault.openBorrowPosition(defaultAccountNumber, defaultAccountNumber, amountWei),
        `IsolationModeVaultV1ActionsImpl: Invalid toAccountNumber <${defaultAccountNumber}>`,
      );
    });

    it('should fail if from sub-account is frozen', async () => {
      await freezeVault();
      await expectThrow(
        userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei),
        `IsolationVaultV1AsyncFreezable: Vault account is frozen <${defaultAccountNumber}>`,
      );
    });

    it('should fail if to sub-account is frozen', async () => {
      await freezeVault(borrowAccountNumber);
      await expectThrow(
        userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei),
        `IsolationVaultV1AsyncFreezable: Vault account is frozen <${borrowAccountNumber}>`,
      );
    });
  });

  describe('#closeBorrowPositionWithUnderlyingVaultToken', () => {
    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, defaultAccountNumber);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, ZERO_BI);
    });

    it('should work normally with execution fee', async () => {
      await factory.connect(core.governance).ownerSetExecutionFee(ONE_ETH_BI);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: ONE_ETH_BI });
      expect(await userVault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(ONE_ETH_BI);
      await expect(
        () => userVault.closeBorrowPositionWithUnderlyingVaultToken(
          borrowAccountNumber,
          defaultAccountNumber,
        )).to.changeEtherBalance(core.hhUser1, ONE_ETH_BI);
      expect(await userVault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(ZERO_BI);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, ZERO_BI);
    });

    it('should fail when not called by owner or converter', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2)
          .closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, defaultAccountNumber),
        `IsolationModeTokenVaultV1: Only owner or converter can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when borrowAccountNumber != 0', async () => {
      await expectThrow(
        userVault.closeBorrowPositionWithUnderlyingVaultToken(defaultAccountNumber, borrowAccountNumber),
        `IsolationModeVaultV1ActionsImpl: Invalid borrowAccountNumber <${defaultAccountNumber}>`,
      );
    });

    it('should fail when toAccountNumber == 0', async () => {
      await expectThrow(
        userVault.closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, borrowAccountNumber),
        `IsolationModeVaultV1ActionsImpl: Invalid toAccountNumber <${borrowAccountNumber}>`,
      );
    });

    it('should fail if borrow sub-account is frozen', async () => {
      await freezeVault(borrowAccountNumber);
      await expectThrow(
        userVault.closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, defaultAccountNumber),
        `IsolationVaultV1AsyncFreezable: Vault account is frozen <${borrowAccountNumber}>`,
      );
    });

    it('should fail if to sub-account is frozen', async () => {
      await freezeVault(defaultAccountNumber);
      await expectThrow(
        userVault.closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, defaultAccountNumber),
        `IsolationVaultV1AsyncFreezable: Vault account is frozen <${defaultAccountNumber}>`,
      );
    });
  });

  describe('#closeBorrowPositionWithOtherTokens', () => {
    it('should work normally', async () => {
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await userVault.closeBorrowPositionWithOtherTokens(borrowAccountNumber, defaultAccountNumber, [otherMarketId1]);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
    });

    it('should fail when underlying is requested to be withdrawn', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await expectThrow(
        userVault.closeBorrowPositionWithOtherTokens(
          borrowAccountNumber,
          defaultAccountNumber,
          [underlyingMarketId],
        ),
        `IsolationModeVaultV1ActionsImpl: Cannot withdraw market to wallet <${underlyingMarketId.toString()}>`,
      );
    });

    it('should fail when not called by owner or converter', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).closeBorrowPositionWithOtherTokens(
          borrowAccountNumber,
          defaultAccountNumber,
          [otherMarketId1],
        ),
        `IsolationModeTokenVaultV1: Only owner or converter can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when borrowAccountNumber != 0', async () => {
      await expectThrow(
        userVault.closeBorrowPositionWithOtherTokens(defaultAccountNumber, borrowAccountNumber, [otherMarketId1]),
        `IsolationModeVaultV1ActionsImpl: Invalid borrowAccountNumber <${defaultAccountNumber}>`,
      );
    });

    it('should fail if from sub-account is frozen', async () => {
      await freezeVault(borrowAccountNumber);
      await expectThrow(
        userVault.closeBorrowPositionWithOtherTokens(borrowAccountNumber, defaultAccountNumber, []),
        `IsolationVaultV1AsyncFreezable: Vault account is frozen <${borrowAccountNumber}>`,
      );
    });
  });

  describe('#transferIntoPositionWithUnderlyingToken', () => {
    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, amountWei);
    });

    it('should fail when not called by owner or converter', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2)
          .transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei),
        `IsolationModeTokenVaultV1: Only owner or converter can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when fromAccountNumber != 0', async () => {
      await expectThrow(
        userVault.transferIntoPositionWithUnderlyingToken(borrowAccountNumber, defaultAccountNumber, amountWei),
        `IsolationModeVaultV1ActionsImpl: Invalid fromAccountNumber <${borrowAccountNumber}>`,
      );
    });

    it('should fail when borrowAccountNumber == 0', async () => {
      await expectThrow(
        userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, defaultAccountNumber, amountWei),
        `IsolationModeVaultV1ActionsImpl: Invalid borrowAccountNumber <${defaultAccountNumber}>`,
      );
    });

    it('should fail if from sub-account is frozen', async () => {
      await freezeVault();
      await expectThrow(
        userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei),
        `IsolationVaultV1AsyncFreezable: Vault account is frozen <${defaultAccountNumber}>`,
      );
    });

    it('should fail if to sub-account is frozen', async () => {
      await freezeVault(borrowAccountNumber);
      await expectThrow(
        userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei),
        `IsolationVaultV1AsyncFreezable: Vault account is frozen <${borrowAccountNumber}>`,
      );
    });
  });

  describe('#transferIntoPositionWithOtherToken', () => {
    it('should work normally', async () => {
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
    });

    it('should work normally when collateral market is allowed', async () => {
      await factory.setAllowableCollateralMarketIds([otherMarketId1]);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
    });

    it('should work normally for disallowed collateral asset that goes negative (debt market)', async () => {
      await factory.setAllowableCollateralMarketIds([core.marketIds.weth]);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.To,
      );
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei.div(2),
        BalanceCheckFlag.None,
      );

      // the default account had $10, then added another $10, then lost $5, so it should have $15
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, BigNumber.from('15000000'));
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei.div(-2));
    });

    it('should work when non-allowable debt market is transferred in', async () => {
      await factory.setAllowableDebtMarketIds([core.marketIds.weth]);
      // attempt to transfer another market ID in
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
    });

    it('should fail when not called by owner or converter', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).transferIntoPositionWithOtherToken(
          defaultAccountNumber,
          borrowAccountNumber,
          otherMarketId1,
          otherAmountWei,
          BalanceCheckFlag.Both,
        ),
        `IsolationModeTokenVaultV1: Only owner or converter can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when borrow account number is 0', async () => {
      await expectThrow(
        userVault.transferIntoPositionWithOtherToken(
          defaultAccountNumber,
          defaultAccountNumber,
          underlyingMarketId,
          amountWei,
          BalanceCheckFlag.Both,
        ),
        `IsolationModeVaultV1ActionsImpl: Invalid borrowAccountNumber <${defaultAccountNumber}>`,
      );
    });

    it('should fail when underlying token is used as transfer token', async () => {
      await expectThrow(
        userVault.transferIntoPositionWithOtherToken(
          defaultAccountNumber,
          borrowAccountNumber,
          underlyingMarketId,
          amountWei,
          BalanceCheckFlag.Both,
        ),
        `IsolationModeVaultV1ActionsImpl: Invalid marketId <${underlyingMarketId.toString()}>`,
      );
    });

    it('should fail when transferring in an unsupported collateral token', async () => {
      await factory.setAllowableCollateralMarketIds([core.marketIds.weth]);
      await expectThrow(
        userVault.transferIntoPositionWithOtherToken(
          defaultAccountNumber,
          borrowAccountNumber,
          otherMarketId1,
          otherAmountWei,
          BalanceCheckFlag.Both,
        ),
        `IsolationModeVaultV1ActionsImpl: Market not allowed as collateral <${otherMarketId1.toString()}>`,
      );
    });

    it('should fail if to sub-account is frozen', async () => {
      await freezeVault(borrowAccountNumber);
      await expectThrow(
        userVault.transferIntoPositionWithOtherToken(
          defaultAccountNumber,
          borrowAccountNumber,
          0,
          amountWei,
          BalanceCheckFlag.Both,
        ),
        `IsolationVaultV1AsyncFreezable: Vault account is frozen <${borrowAccountNumber}>`,
      );
    });
  });

  describe('#transferFromPositionWithUnderlyingToken', () => {
    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferFromPositionWithUnderlyingToken(borrowAccountNumber, defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, ZERO_BI);
    });

    it('should fail when not called by owner or converter', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2)
          .transferFromPositionWithUnderlyingToken(borrowAccountNumber, defaultAccountNumber, amountWei),
        `IsolationModeTokenVaultV1: Only owner or converter can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when borrowAccountNumber != 0', async () => {
      await expectThrow(
        userVault.transferFromPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei),
        `IsolationModeVaultV1ActionsImpl: Invalid borrowAccountNumber <${defaultAccountNumber}>`,
      );
    });

    it('should fail when toAccountNumber == 0', async () => {
      await expectThrow(
        userVault.transferFromPositionWithUnderlyingToken(borrowAccountNumber, borrowAccountNumber, amountWei),
        `IsolationModeVaultV1ActionsImpl: Invalid toAccountNumber <${borrowAccountNumber}>`,
      );
    });

    it('should fail if from sub-account is frozen', async () => {
      await freezeVault(borrowAccountNumber);
      await expectThrow(
        userVault.transferFromPositionWithUnderlyingToken(borrowAccountNumber, defaultAccountNumber, amountWei),
        `IsolationVaultV1AsyncFreezable: Vault account is frozen <${borrowAccountNumber}>`,
      );
    });

    it('should fail if to sub-account is frozen', async () => {
      await freezeVault(defaultAccountNumber);
      await expectThrow(
        userVault.transferFromPositionWithUnderlyingToken(borrowAccountNumber, defaultAccountNumber, amountWei),
        `IsolationVaultV1AsyncFreezable: Vault account is frozen <${defaultAccountNumber}>`,
      );
    });
  });

  describe('#transferFromPositionWithOtherToken', () => {
    it('should work when no allowable debt market is set (all are allowed then)', async () => {
      await factory.setAllowableDebtMarketIds([]);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.To,
      );
    });

    it('should work when 1 allowable debt market is set', async () => {
      await factory.setAllowableDebtMarketIds([otherMarketId1]);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei.div(2),
        BalanceCheckFlag.To,
      );
    });

    it('should work when 1 allowable collateral market is set', async () => {
      await factory.setAllowableCollateralMarketIds([core.marketIds.weth]);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.To,
      );
    });

    it('should work when 1 allowable debt market is set', async () => {
      await factory.setAllowableDebtMarketIds([core.marketIds.weth]);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.None,
      );
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei.div(2),
        BalanceCheckFlag.None,
      );
    });

    it('should fail when not called by owner or converter', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).transferFromPositionWithOtherToken(
          borrowAccountNumber,
          defaultAccountNumber,
          otherMarketId1,
          otherAmountWei,
          BalanceCheckFlag.Both,
        ),
        `IsolationModeTokenVaultV1: Only owner or converter can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when borrowAccountNumber is 0', async () => {
      await expectThrow(
        userVault.transferFromPositionWithOtherToken(
          defaultAccountNumber,
          defaultAccountNumber,
          otherMarketId1,
          amountWei,
          BalanceCheckFlag.Both,
        ),
        'IsolationModeVaultV1ActionsImpl: Invalid borrowAccountNumber <0>',
      );
    });

    it('should fail when not underlying market is used', async () => {
      await expectThrow(
        userVault.transferFromPositionWithOtherToken(
          borrowAccountNumber,
          defaultAccountNumber,
          underlyingMarketId,
          amountWei,
          BalanceCheckFlag.Both,
        ),
        `IsolationModeVaultV1ActionsImpl: Invalid marketId <${underlyingMarketId.toString()}>`,
      );
    });

    it('should fail when an invalid debt market is used', async () => {
      await factory.setAllowableDebtMarketIds([core.marketIds.weth]);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await expectThrow(
        userVault.transferFromPositionWithOtherToken(
          borrowAccountNumber,
          defaultAccountNumber,
          otherMarketId1,
          otherAmountWei,
          BalanceCheckFlag.To,
        ),
        `IsolationModeVaultV1ActionsImpl: Market not allowed as debt <${otherMarketId1}>`,
      );
    });

    it('should fail if borrow sub-account is frozen', async () => {
      await freezeVault(borrowAccountNumber);
      await expectThrow(
        userVault.transferFromPositionWithOtherToken(
          borrowAccountNumber,
          defaultAccountNumber,
          0,
          amountWei,
          BalanceCheckFlag.Both,
        ),
        `IsolationVaultV1AsyncFreezable: Vault account is frozen <${borrowAccountNumber}>`,
      );
    });
  });

  describe('#repayAllForBorrowPosition', () => {
    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei.div(2),
        BalanceCheckFlag.To,
      );
      await userVault.repayAllForBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, amountWei);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).repayAllForBorrowPosition(
          defaultAccountNumber,
          borrowAccountNumber,
          otherMarketId1,
          BalanceCheckFlag.Both,
        ),
        `IsolationModeTokenVaultV1: Only owner or converter can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when borrowAccountNumber is not 0', async () => {
      await expectThrow(
        userVault.repayAllForBorrowPosition(
          defaultAccountNumber,
          defaultAccountNumber,
          underlyingMarketId,
          BalanceCheckFlag.Both,
        ),
        'IsolationModeVaultV1ActionsImpl: Invalid borrowAccountNumber <0>',
      );
    });

    it('should fail when underlying market is repaid', async () => {
      await expectThrow(
        userVault.repayAllForBorrowPosition(
          defaultAccountNumber,
          borrowAccountNumber,
          underlyingMarketId,
          BalanceCheckFlag.Both,
        ),
        `IsolationModeVaultV1ActionsImpl: Invalid marketId <${underlyingMarketId.toString()}>`,
      );
    });

    it('should fail if borrow sub-account is frozen', async () => {
      await freezeVault(borrowAccountNumber);
      await expectThrow(
        userVault.repayAllForBorrowPosition(
          defaultAccountNumber,
          borrowAccountNumber,
          otherMarketId1,
          BalanceCheckFlag.Both,
        ),
        `IsolationVaultV1AsyncFreezable: Vault account is frozen <${borrowAccountNumber}>`,
      );
    });
  });

  describe('#addCollateralAndSwapExactInputForOutput', () => {
    it('should work for other token when balance is 0', async () => {
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, ZERO_BI);

      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, outputAmount, core);
      await userVault.addCollateralAndSwapExactInputForOutput(
        defaultAccountNumber,
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, outputAmount);
    });

    it('should work for other token when balance is positive', async () => {
      const inputAmount = otherAmountWei.div(2);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        inputAmount,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, inputAmount);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, inputAmount);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, ZERO_BI);

      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, inputAmount, otherMarketId2, outputAmount, core);
      await userVault.addCollateralAndSwapExactInputForOutput(
        defaultAccountNumber,
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, inputAmount);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, outputAmount);
    });

    it('should work normally for isolation unwrapper', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, ZERO_BI);

      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getUnwrapZapParams(
        underlyingMarketId,
        amountWei,
        otherMarketId1,
        outputAmount,
        tokenUnwrapper,
        core,
      );
      await userVault.connect(impersonatedUnwrapper).addCollateralAndSwapExactInputForOutput(
        defaultAccountNumber,
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );

      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, outputAmount);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, ZERO_BI);
    });

    it('should fail if user is underwater and attempting to initiate wrapping', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
      );

      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        usdcAmount,
        BalanceCheckFlag.None,
      );

      await core.testEcosystem!.testPriceOracle.setPrice(
        factory.address,
        '10',
      );

      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(
        otherMarketId1,
        otherAmountWei,
        underlyingMarketId,
        outputAmount,
        core,
      );
      await expectThrow(
        userVault.addCollateralAndSwapExactInputForOutput(
          borrowAccountNumber,
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        'IsolationModeVaultV1ActionsImpl: Account liquidatable',
      );
    });

    it('should fail when not called by vault owner or converter', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, otherAmountWei, core);
      await expectThrow(
        userVault.connect(core.hhUser2).addCollateralAndSwapExactInputForOutput(
          defaultAccountNumber,
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        `IsolationModeTokenVaultV1: Only owner or converter can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail if transferred asset (from input) is negative', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.To,
      );
      await withdrawFromDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, MAX_UINT_256_BI);

      const zapParams = await getSimpleZapParams(
        otherMarketId1,
        otherAmountWei.div(4),
        otherMarketId2,
        otherAmountWei,
        core,
      );
      await expectThrow(
        userVault.addCollateralAndSwapExactInputForOutput(
          defaultAccountNumber,
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        `AccountBalanceLib: account cannot go negative <${core.hhUser1.address.toLowerCase()}, ${defaultAccountNumber}, ${zapParams.marketIdsPath[0].toString()}>`,
      );
    });

    it('should fail if vault is frozen', async () => {
      await freezeVault();
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, amountWei, core);
      await expectThrow(
        userVault.addCollateralAndSwapExactInputForOutput(
          defaultAccountNumber,
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        `IsolationModeTokenVaultV1: Only converter can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail marketIds path > 2', async () => {
      await expectThrow(
        userVault.addCollateralAndSwapExactInputForOutput(
          defaultAccountNumber,
          borrowAccountNumber,
          [core.marketIds.usdc, core.marketIds.nativeUsdc, underlyingMarketId],
          amountWei,
          ONE_BI,
          [
            {
              trader: ADDRESS_ZERO,
              traderType: GenericTraderType.IsolationModeWrapper,
              tradeData: BYTES_EMPTY,
              makerAccountIndex: 0,
            },
          ],
          [],
          { deadline: 12312312311, eventType: GenericEventEmissionType.None, balanceCheckFlag: BalanceCheckFlag.None },
          { value: parseEther('0.01') },
        ),
        'IsolationVaultV1AsyncFreezable: Invalid marketIds path for wrap',
      );
    });
  });

  describe('#swapExactInputForOutputAndRemoveCollateral', () => {
    it('should work for other output token when balance before is zero', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, ZERO_BI);

      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, outputAmount, core);
      await userVault.swapExactInputForOutputAndRemoveCollateral(
        defaultAccountNumber,
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );

      await expectProtocolBalance(core, userVault, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(
        core,
        userVault,
        borrowAccountNumber,
        otherMarketId1,
        ZERO_BI,
      );
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        otherMarketId2,
        otherAmountWei.add(outputAmount),
      );
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, ZERO_BI);
    });

    it('should work for other output token when balance before is positive', async () => {
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, otherAmountWei);

      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, outputAmount, core);
      await userVault.swapExactInputForOutputAndRemoveCollateral(
        defaultAccountNumber,
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(
        core,
        userVault,
        borrowAccountNumber,
        otherMarketId1,
        ZERO_BI,
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, outputAmount);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, otherAmountWei);
    });

    it('should work for isolation output token when balance before is positive', async () => {
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, otherAmountWei);

      const minAmountOut = ONE_ETH_BI;
      const zapParams = await getWrapZapParams(
        otherMarketId1,
        otherAmountWei,
        underlyingMarketId,
        minAmountOut,
        tokenWrapper,
        core,
      );
      await userVault.swapExactInputForOutputAndRemoveCollateral(
        defaultAccountNumber,
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );

      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, minAmountOut);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(
        core,
        userVault,
        borrowAccountNumber,
        otherMarketId1,
        ZERO_BI,
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, otherAmountWei);
    });

    it('should work when transferred asset (from output) is negative', async () => {
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      const borrowAmount = otherAmountWei.div(2);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId2,
        borrowAmount,
        BalanceCheckFlag.To,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        otherMarketId2,
        otherAmountWei.add(borrowAmount),
      );
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, borrowAmount.mul(-1));

      const inputAmount = otherAmountWei.div(4);
      const outputAmount = otherAmountWei.div(8);
      const zapParams = await getSimpleZapParams(otherMarketId1, inputAmount, otherMarketId2, outputAmount, core);
      await userVault.swapExactInputForOutputAndRemoveCollateral(
        defaultAccountNumber,
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(
        core,
        userVault,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei.sub(inputAmount),
      );
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        otherMarketId2,
        otherAmountWei.add(borrowAmount).add(outputAmount),
      );
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, borrowAmount.mul(-1));
    });

    it('should fail for isolation output token when min output is too large', async () => {
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, otherAmountWei);

      const zapParams = await getWrapZapParams(
        otherMarketId1,
        otherAmountWei,
        underlyingMarketId,
        amountWei,
        tokenWrapper,
        core,
      );
      await expectThrow(
        userVault.swapExactInputForOutputAndRemoveCollateral(
          defaultAccountNumber,
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        'IsolationModeVaultV1ActionsImpl: minOutputAmount too large',
      );
    });

    it('should fail if user is underwater and attempting to initiate wrapping', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
      );

      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        usdcAmount,
        BalanceCheckFlag.None,
      );

      await core.testEcosystem!.testPriceOracle.setPrice(
        factory.address,
        '10',
      );

      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(
        otherMarketId1,
        otherAmountWei,
        underlyingMarketId,
        outputAmount,
        core,
      );
      await expectThrow(
        userVault.swapExactInputForOutputAndRemoveCollateral(
          borrowAccountNumber,
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        'IsolationModeVaultV1ActionsImpl: Account liquidatable',
      );
    });

    it('should fail when not called by vault owner or converter', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, otherAmountWei, core);
      await expectThrow(
        userVault.connect(core.hhUser2).swapExactInputForOutputAndRemoveCollateral(
          defaultAccountNumber,
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        `IsolationModeTokenVaultV1: Only owner or converter can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail if vault is frozen', async () => {
      await freezeVault();
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, amountWei, core);
      await expectThrow(
        userVault.swapExactInputForOutputAndRemoveCollateral(
          defaultAccountNumber,
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        `IsolationModeTokenVaultV1: Only converter can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail marketIds path > 2', async () => {
      await expectThrow(
        userVault.swapExactInputForOutputAndRemoveCollateral(
          defaultAccountNumber,
          borrowAccountNumber,
          [core.marketIds.usdc, core.marketIds.nativeUsdc, underlyingMarketId],
          amountWei,
          ONE_BI,
          [
            {
              trader: ADDRESS_ZERO,
              traderType: GenericTraderType.IsolationModeWrapper,
              tradeData: BYTES_EMPTY,
              makerAccountIndex: 0,
            },
          ],
          [],
          { deadline: 12312312311, eventType: GenericEventEmissionType.None, balanceCheckFlag: BalanceCheckFlag.None },
          { value: parseEther('0.01') },
        ),
        'IsolationVaultV1AsyncFreezable: Invalid marketIds path for wrap',
      );
    });
  });

  describe('#swapExactInputForOutput', () => {
    it('should work normally', async () => {
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, otherAmountWei);

      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, outputAmount, core);
      await userVault.swapExactInputForOutput(
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(
        core,
        userVault,
        borrowAccountNumber,
        otherMarketId1,
        ZERO_BI,
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(
        core,
        userVault,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei.add(outputAmount),
      );
    });

    it('should fail if user is underwater and attempting to initiate wrapping', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
      );

      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        usdcAmount,
        BalanceCheckFlag.None,
      );

      await core.testEcosystem!.testPriceOracle.setPrice(
        factory.address,
        '10',
      );

      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(
        otherMarketId1,
        otherAmountWei,
        underlyingMarketId,
        outputAmount,
        core,
      );
      await expectThrow(
        userVault.swapExactInputForOutput(
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        'IsolationModeVaultV1ActionsImpl: Account liquidatable',
      );
    });

    it('should fail when not called by vault owner or converter', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, otherAmountWei, core);
      await expectThrow(
        userVault.connect(core.hhUser2).swapExactInputForOutput(
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        `IsolationModeTokenVaultV1: Only owner or converter can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail if tradeAccountNumber is 0', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, otherAmountWei, core);
      await expectThrow(
        userVault.swapExactInputForOutput(
          defaultAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        'IsolationModeVaultV1ActionsImpl: Invalid tradeAccountNumber <0>',
      );
    });

    it('should fail if inputMarketId is not allowed collateral', async () => {
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await factory.setAllowableCollateralMarketIds([otherMarketId2]);
      const inputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, inputAmount, otherMarketId2, otherAmountWei, core);
      await expectThrow(
        userVault.swapExactInputForOutput(
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        `IsolationModeVaultV1ActionsImpl: Market not allowed as collateral <${otherMarketId1.toString()}>`,
      );
    });

    it('should fail if inputMarketId is not allowed debt', async () => {
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await factory.setAllowableDebtMarketIds([otherMarketId2]);
      const inputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, inputAmount, otherMarketId2, otherAmountWei, core);
      await expectThrow(
        userVault.swapExactInputForOutput(
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        `IsolationModeVaultV1ActionsImpl: Market not allowed as debt <${otherMarketId1.toString()}>`,
      );
    });

    it('should fail if outputMarketId is not allowed collateral', async () => {
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await factory.setAllowableCollateralMarketIds([otherMarketId1]);
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, otherAmountWei, core);
      await expectThrow(
        userVault.swapExactInputForOutput(
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        `IsolationModeVaultV1ActionsImpl: Market not allowed as collateral <${otherMarketId2.toString()}>`,
      );
    });

    it('should fail if outputMarketId is not allowed debt', async () => {
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      const borrowAmount = otherAmountWei.div(2);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId2,
        borrowAmount,
        BalanceCheckFlag.To,
      );
      await factory.setAllowableDebtMarketIds([otherMarketId1]);
      const zapParams = await getSimpleZapParams(
        otherMarketId1,
        borrowAmount,
        otherMarketId2,
        borrowAmount.div(2),
        core,
      );
      await expectThrow(
        userVault.swapExactInputForOutput(
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        `IsolationModeVaultV1ActionsImpl: Market not allowed as debt <${otherMarketId2.toString()}>`,
      );
    });

    it('should fail if vault is frozen and called by owner', async () => {
      await freezeVault();
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, amountWei, core);
      await expectThrow(
        userVault.swapExactInputForOutput(
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        `IsolationModeTokenVaultV1: Only converter can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail marketIds path > 2', async () => {
      await expectThrow(
        userVault.swapExactInputForOutput(
          borrowAccountNumber,
          [core.marketIds.usdc, core.marketIds.nativeUsdc, underlyingMarketId],
          100,
          1,
          [
            {
              trader: ADDRESS_ZERO,
              traderType: GenericTraderType.IsolationModeWrapper,
              tradeData: BYTES_EMPTY,
              makerAccountIndex: 0,
            },
          ],
          [],
          { deadline: 12312312311, eventType: GenericEventEmissionType.None, balanceCheckFlag: BalanceCheckFlag.None },
          { value: parseEther('0.01') },
        ),
        'IsolationVaultV1AsyncFreezable: Invalid marketIds path for wrap',
      );
    });
  });

  describe('#executeDepositIntoVault', () => {
    it('should work normally', async () => {
      const factoryImpersonator = await impersonate(factory.address, true);
      await underlyingToken.addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(userVault.address, amountWei);

      await userVault.connect(factoryImpersonator).executeDepositIntoVault(core.hhUser1.address, amountWei);
    });

    it('should work normally if isDepositSourceWrapper is true', async () => {
      const factoryImpersonator = await impersonate(factory.address, true);
      const wrapperImpersonator = await impersonate(tokenWrapper.address, true);
      await registry.connect(core.governance).ownerSetWrapperByToken(factory.address, tokenWrapper.address);
      await underlyingToken.addBalance(tokenWrapper.address, amountWei);
      await underlyingToken.connect(wrapperImpersonator).approve(userVault.address, amountWei);

      await userVault.connect(factoryImpersonator).setIsVaultDepositSourceWrapper(true);
      await userVault.connect(factoryImpersonator).executeDepositIntoVault(core.hhUser1.address, amountWei);
    });

    it('should work normally if shouldSkipTransfer is true', async () => {
      const factoryImpersonator = await impersonate(factory.address, true);
      await underlyingToken.addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(userVault.address, amountWei);

      await userVault.connect(factoryImpersonator).setShouldVaultSkipTransfer(true);
      await freezeVault();
      await userVault.connect(factoryImpersonator).executeDepositIntoVault(core.hhUser1.address, amountWei);
    });

    it('should fail if shouldSkipTransfer is true and vault is NOT frozen', async () => {
      const factoryImpersonator = await impersonate(factory.address, true);
      await underlyingToken.addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(userVault.address, amountWei);

      await userVault.connect(factoryImpersonator).setShouldVaultSkipTransfer(true);
      await expectThrow(
        userVault.connect(factoryImpersonator).executeDepositIntoVault(core.hhUser1.address, amountWei),
        'IsolationVaultV1AsyncFreezable: Vault should be frozen',
      );
    });

    it('should fail when not called by factory', async () => {
      await expectThrow(
        userVault.connect(core.hhUser1).executeDepositIntoVault(core.hhUser1.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeWithdrawalFromVault', () => {
    it('should work if shouldSkipTransfer', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      const factoryImpersonator = await impersonate(factory.address, true);
      await userVault.connect(factoryImpersonator).setShouldVaultSkipTransfer(true);
      await freezeVault();

      await userVault.connect(factoryImpersonator).executeWithdrawalFromVault(core.hhUser1.address, amountWei);
      await expectWalletBalance(userVault.address, underlyingToken, amountWei);
    });

    it('should fail if shouldSkipTransfer and vault is NOT frozen', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      const factoryImpersonator = await impersonate(factory.address, true);
      await userVault.connect(factoryImpersonator).setShouldVaultSkipTransfer(true);

      await expectThrow(
        userVault.connect(factoryImpersonator).executeWithdrawalFromVault(core.hhUser1.address, amountWei),
        'IsolationVaultV1AsyncFreezable: Vault should be frozen',
      );
    });

    it('should fail when not called by factory', async () => {
      await expectThrow(
        userVault.connect(core.hhUser1).executeWithdrawalFromVault(core.hhUser1.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setVaultAccountPendingAmountForFrozenStatus', () => {
    it('should work normally', async () => {
      expect(await userVault.isVaultFrozen()).to.eq(false);
      const result = await freezeVault();
      await expectEvent(factory, result, 'VaultAccountFrozen', {
        vault: userVault.address,
        accountNumber: defaultAccountNumber,
        isVaultFrozen: true,
      });
      expect(await userVault.isVaultFrozen()).to.eq(true);
      expect(await userVault.getOutputTokenByVaultAccount(defaultAccountNumber)).to.eq(core.tokens.usdc.address);
    });

    it('should fail if not called by vault', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).setVaultAccountPendingAmountForFrozenStatus(
          userVault.address,
          defaultAccountNumber,
          FreezeType.Deposit,
          PLUS_ONE_BI,
          core.tokens.usdc.address,
        ),
        `FreezableVaultFactory: Caller is not a authorized <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if invalid vault is passed through', async () => {
      await expectThrow(
        factory.connect(impersonatedVault).setVaultAccountPendingAmountForFrozenStatus(
          core.hhUser1.address,
          defaultAccountNumber,
          FreezeType.Deposit,
          PLUS_ONE_BI,
          core.tokens.usdc.address,
        ),
        `IsolationModeVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#initiateUnwrapping', () => {
    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.initiateUnwrapping(
        defaultAccountNumber,
        amountWei,
        otherToken1.address,
        ONE_BI,
        BYTES_EMPTY,
      );
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).initiateUnwrapping(
          defaultAccountNumber,
          amountWei,
          otherToken1.address,
          ONE_BI,
          BYTES_EMPTY,
        ),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail if input amount is zero', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectThrow(
        userVault.initiateUnwrapping(
          defaultAccountNumber,
          ZERO_BI,
          otherToken1.address,
          ONE_BI,
          BYTES_EMPTY,
        ),
        'IsolationVaultV1AsyncFreezable: Invalid withdrawal amount',
      );
    });

    it('should fail if min output amount is zero', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectThrow(
        userVault.initiateUnwrapping(
          defaultAccountNumber,
          amountWei,
          otherToken1.address,
          ZERO_BI,
          BYTES_EMPTY,
        ),
        'IsolationVaultV1AsyncFreezable: Invalid minOutputAmount',
      );
    });

    it('should fail if input amount is greater than users balance', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectThrow(
        userVault.initiateUnwrapping(
          defaultAccountNumber,
          amountWei.add(1),
          otherToken1.address,
          ONE_BI,
          BYTES_EMPTY,
        ),
        `IsolationVaultV1AsyncFreezable: Withdrawal too large <${userVault.address.toLowerCase()}, ${defaultAccountNumber}>`,
      );
    });

    it('should fail if vault is frozen', async () => {
      await factory.connect(core.governance).setVaultAccountPendingAmountForFrozenStatus(
        userVault.address,
        defaultAccountNumber,
        FreezeType.Deposit,
        PLUS_ONE_BI,
        otherToken1.address,
      );
      await expectThrow(
        userVault.initiateUnwrapping(
          defaultAccountNumber,
          amountWei,
          otherToken1.address,
          ONE_BI,
          BYTES_EMPTY,
        ),
        'IsolationModeVaultV1Freezable: Vault is frozen',
      );
    });

    it('should fail if liquidatable', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
      );
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        usdcAmount,
        BalanceCheckFlag.None,
      );

      await core.testEcosystem!.testPriceOracle.setPrice(
        factory.address,
        '10',
      );
      await expectThrow(
        userVault.initiateUnwrapping(
          borrowAccountNumber,
          amountWei,
          otherToken1.address,
          ONE_BI,
          BYTES_EMPTY,
        ),
        'IsolationModeVaultV1ActionsImpl: Account liquidatable',
      );
    });

    it('should fail if reentrant', async () => {
      await expectThrow(
        userVault.callInitiateUnwrappingAndTriggerReentrancy(
          borrowAccountNumber,
          amountWei,
          otherToken1.address,
          ONE_BI,
          BYTES_EMPTY,
        ),
        'IsolationModeTokenVaultV1: Reentrant call',
      );
    });
  });

  describe('#initiateUnwrappingForLiquidation', () => {
    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.connect(core.hhUser3).initiateUnwrappingForLiquidation(
        defaultAccountNumber,
        amountWei,
        otherToken1.address,
        ONE_BI,
        BYTES_EMPTY,
      );
    });

    it('should fail if not liquidator', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(underlyingMarketId, core.hhUser2.address);
      await expectThrow(
        userVault.connect(core.hhUser3).initiateUnwrappingForLiquidation(
          defaultAccountNumber,
          amountWei,
          otherToken1.address,
          ONE_BI,
          BYTES_EMPTY,
        ),
        `IsolationVaultV1AsyncFreezable: Only liquidator can call <${core.hhUser3.address.toLowerCase()}>`,
      );
    });

    it('should fail if not requested for users entire balance', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectThrow(
        userVault.connect(core.hhUser3).initiateUnwrappingForLiquidation(
          defaultAccountNumber,
          amountWei.sub(1),
          otherToken1.address,
          ONE_BI,
          BYTES_EMPTY,
        ),
        `IsolationVaultV1AsyncFreezable: Liquidation must be full balance <${userVault.address.toLowerCase()}, ${defaultAccountNumber}>`,
      );
    });

    it('should fail if user has no balance or pending amounts', async () => {
      await expectThrow(
        userVault.connect(core.hhUser3).initiateUnwrappingForLiquidation(
          defaultAccountNumber,
          amountWei,
          otherToken1.address,
          ONE_BI,
          BYTES_EMPTY,
        ),
        `IsolationVaultV1AsyncFreezable: Account is frozen <${userVault.address.toLowerCase()}, ${defaultAccountNumber}>`,
      );
    });

    it('should fail if reentrant', async () => {
      await expectThrow(
        userVault.callInitiateUnwrappingForLiquidationAndTriggerReentrancy(
          borrowAccountNumber,
          amountWei,
          otherToken1.address,
          ONE_BI,
          BYTES_EMPTY,
        ),
        'IsolationModeTokenVaultV1: Reentrant call',
      );
    });
  });

  describe('#requireVaultAccountNotFrozen', () => {
    it('should work normally', async () => {
      await userVault.testRequireVaultAccountNotFrozen(defaultAccountNumber);
    });

    it('should fail if vault account is frozen', async () => {
      await factory.connect(core.governance).setVaultAccountPendingAmountForFrozenStatus(
        userVault.address,
        defaultAccountNumber,
        FreezeType.Deposit,
        PLUS_ONE_BI,
        otherToken1.address,
      );
      await expectThrow(
        userVault.testRequireVaultAccountNotFrozen(defaultAccountNumber),
        '',
      );
    });
  });

  describe('#setIsVaultDepositSourceWrapper', () => {
    it('should work normally', async () => {
      const factoryImpersonator = await impersonate(factory.address, true);
      await userVault.connect(factoryImpersonator).setIsVaultDepositSourceWrapper(true);
      expect(await userVault.isDepositSourceWrapper()).to.eq(true);
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).setIsVaultDepositSourceWrapper(true),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setShouldVaultSkipTransfer', () => {
    it('should work normally', async () => {
      const factoryImpersonator = await impersonate(factory.address, true);
      await userVault.connect(factoryImpersonator).setShouldVaultSkipTransfer(true);
      expect(await userVault.shouldSkipTransfer()).to.eq(true);
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).setShouldVaultSkipTransfer(true),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#handlerRegistry', () => {
    it('should work normally', async () => {
      expect(await userVault.handlerRegistry()).to.eq(registry.address);
    });
  });
});
