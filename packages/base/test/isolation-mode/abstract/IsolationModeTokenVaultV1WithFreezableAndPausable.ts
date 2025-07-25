import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin/dist/src';
import { expect } from 'chai';
import { BigNumber, ContractTransaction } from 'ethers';
import {
  CustomTestToken,
  DepositWithdrawalRouter,
  DepositWithdrawalRouter__factory,
  RouterProxy__factory,
  TestIsolationModeTokenVaultV1WithFreezableAndPausable,
  TestIsolationModeTokenVaultV1WithFreezableAndPausable__factory,
  TestIsolationModeUnwrapperTraderV2,
  TestIsolationModeUnwrapperTraderV2__factory,
  TestIsolationModeVaultFactory,
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
import { MAX_UINT_256_BI, Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectProtocolBalance, expectThrow, expectTotalSupply, expectWalletBalance } from '../../utils/assertions';

import { CoreProtocolArbitrumOne } from '../../utils/core-protocols/core-protocol-arbitrum-one';
import { createAndUpgradeDolomiteRegistry, createIsolationModeTokenVaultV1ActionsImpl } from '../../utils/dolomite';
import { createTestIsolationModeVaultFactory } from '../../utils/ecosystem-utils/testers';
import {
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '../../utils/setup';
import { getSimpleZapParams, getUnwrapZapParams, getWrapZapParams } from '../../utils/zap-utils';

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10
const bigOtherAmountWei = BigNumber.from('100000000000'); // $100,000

describe('IsolationModeTokenVaultV1WithFreezableAndPausable', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: CustomTestToken;
  let underlyingMarketId: BigNumber;
  let tokenUnwrapper: TestIsolationModeUnwrapperTraderV2;
  let tokenWrapper: TestIsolationModeWrapperTraderV2;
  let factory: TestIsolationModeVaultFactory;
  let userVaultImplementation: TestIsolationModeTokenVaultV1WithFreezableAndPausable;
  let userVault: TestIsolationModeTokenVaultV1WithFreezableAndPausable;

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
      [core.dolomiteRegistry.address, core.dolomiteMargin.address]
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
    userVaultImplementation = await createContractWithLibrary<TestIsolationModeTokenVaultV1WithFreezableAndPausable>(
      'TestIsolationModeTokenVaultV1WithFreezableAndPausable',
      libraries,
      [],
    );
    factory = await createTestIsolationModeVaultFactory(
      core,
      underlyingToken,
      userVaultImplementation as any,
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
      [tokenUnwrapper.address, tokenWrapper.address, core.depositWithdrawalRouter.address]
    );

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    userVault = setupUserVaultProxy<TestIsolationModeTokenVaultV1WithFreezableAndPausable>(
      vaultAddress,
      TestIsolationModeTokenVaultV1WithFreezableAndPausable__factory,
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

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  async function freezeVault(): Promise<ContractTransaction> {
    return userVault.setIsVaultFrozen(true);
  }

  async function pauseVault(): Promise<ContractTransaction> {
    return userVault.setIsExternalRedemptionPaused(true);
  }

  describe('basic read functions', () => {
    it('should work', async () => {
      expect(await userVault.UNDERLYING_TOKEN()).to.eq(underlyingToken.address);
      expect(await userVault.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await userVault.BORROW_POSITION_PROXY()).to.eq(core.borrowPositionProxyV2.address);
      expect(await userVault.VAULT_FACTORY()).to.eq(factory.address);
      expect(await userVault.marketId()).to.eq(underlyingMarketId);

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

    it('should fail if frozen', async () => {
      await freezeVault();
      await expectThrow(
        userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei),
        'IsolationModeVaultV1Freezable: Vault is frozen',
      );
    });

    it('should fail if paused', async () => {
      await pauseVault();
      await expectThrow(
        userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei),
        'IsolationModeVaultV1Pausable: Cannot execute when paused',
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

    it('should work normally if paused and no debt', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.setIsExternalRedemptionPaused(true);
      await userVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);

      await expectWalletBalance(core.dolomiteMargin, factory, ZERO_BI);
      await expectWalletBalance(userVault, underlyingToken, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);

      await expectTotalSupply(factory, ZERO_BI);
    });

    it('should fail if vault is frozen', async () => {
      await freezeVault();
      await expectThrow(
        userVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei),
        'IsolationModeVaultV1Freezable: Vault is frozen',
      );
    });

    it('should fail to lever up if paused', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.transferIntoPositionWithUnderlyingToken(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
      );
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        1,
        BalanceCheckFlag.None,
      );

      await userVault.setIsExternalRedemptionPaused(true);
      await expectThrow(
        core.depositWithdrawalRouter.connect(core.hhUser1).withdrawWei(
          underlyingMarketId,
          borrowAccountNumber,
          underlyingMarketId,
          ONE_BI,
          0,
        ),
        'IsolationModeVaultV1Pausable: Cannot lever up when paused',
      );
    });
  });

  describe('#openBorrowPosition', () => {
    it('should work normally when not paused or frozen', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await userVault.isExternalRedemptionPaused()).to.be.false;
      expect(await userVault.isVaultFrozen()).to.be.false;
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, amountWei);
    });

    it('should fail when paused', async () => {
      await userVault.setIsExternalRedemptionPaused(true);
      expect(await userVault.isExternalRedemptionPaused()).to.be.true;
      await expectThrow(
        userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei),
        'IsolationModeVaultV1Pausable: Cannot execute when paused',
      );
    });

    it('should fail if vault is frozen', async () => {
      await freezeVault();
      await expectThrow(
        userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei),
        'IsolationModeVaultV1Freezable: Vault is frozen',
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

    it('should fail if vault is frozen', async () => {
      await freezeVault();
      await expectThrow(
        userVault.closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, defaultAccountNumber),
        'IsolationModeVaultV1Freezable: Vault is frozen',
      );
    });
  });

  describe('#closeBorrowPositionWithOtherTokens', () => {
    it('should work normally when not paused or frozen', async () => {
      expect(await userVault.isExternalRedemptionPaused()).to.be.false;
      expect(await userVault.isVaultFrozen()).to.be.false;
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

    it('should work when paused but the user has no debt', async () => {
      await userVault.setIsExternalRedemptionPaused(true);
      expect(await userVault.isExternalRedemptionPaused()).to.be.true;
      expect(await userVault.isVaultFrozen()).to.be.false;
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

    it('should fail when paused and the user has debt', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.None,
      );
      await userVault.setIsExternalRedemptionPaused(true);
      expect(await userVault.isExternalRedemptionPaused()).to.be.true;
      expect(await userVault.isVaultFrozen()).to.be.false;
      await expectThrow(
        userVault.closeBorrowPositionWithOtherTokens(
          borrowAccountNumber,
          defaultAccountNumber,
          [otherMarketId2],
        ),
        'IsolationModeVaultV1Pausable: Cannot lever up when paused',
      );
    });

    it('should fail if vault is frozen', async () => {
      await freezeVault();
      await expectThrow(
        userVault.closeBorrowPositionWithOtherTokens(borrowAccountNumber, defaultAccountNumber, []),
        'IsolationModeVaultV1Freezable: Vault is frozen',
      );
    });
  });

  describe('#transferIntoPositionWithUnderlyingToken', () => {
    it('should work normally when not paused or frozen', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await userVault.isExternalRedemptionPaused()).to.be.false;
      expect(await userVault.isVaultFrozen()).to.be.false;
      await userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, amountWei);
    });

    it('should fail when paused', async () => {
      await userVault.setIsExternalRedemptionPaused(true);
      expect(await userVault.isExternalRedemptionPaused()).to.be.true;
      await expectThrow(
        userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei),
        'IsolationModeVaultV1Pausable: Cannot execute when paused',
      );
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

    it('should fail if vault is frozen', async () => {
      await freezeVault();
      await expectThrow(
        userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei),
        'IsolationModeVaultV1Freezable: Vault is frozen',
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

    it('should fail if vault is frozen', async () => {
      await freezeVault();
      await expectThrow(
        userVault.transferIntoPositionWithOtherToken(
          defaultAccountNumber,
          borrowAccountNumber,
          0,
          amountWei,
          BalanceCheckFlag.Both,
        ),
        'IsolationModeVaultV1Freezable: Vault is frozen',
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

    it('should fail if vault is frozen', async () => {
      await freezeVault();
      await expectThrow(
        userVault.transferFromPositionWithUnderlyingToken(borrowAccountNumber, defaultAccountNumber, amountWei),
        'IsolationModeVaultV1Freezable: Vault is frozen',
      );
    });
  });

  describe('#transferFromPositionWithOtherToken', () => {
    it('should work when paused and debt is repaid', async () => {
      await factory.setAllowableDebtMarketIds([]);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.To,
      );
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);

      await userVault.setIsExternalRedemptionPaused(true);
      expect(await userVault.isExternalRedemptionPaused()).to.be.true;

      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.To,
      );

      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);
    });

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

    it('should work when 1 allowable debt market is set & market is paused', async () => {
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

      await userVault.setIsExternalRedemptionPaused(true);
      expect(await userVault.isExternalRedemptionPaused()).to.be.true;

      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei.div(2),
        BalanceCheckFlag.None,
      );
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei.div(2));
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei.div(2),
      );
    });

    it('should work when paused but collateralization is not decreased', async () => {
      await factory.setAllowableDebtMarketIds([]);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.None,
      );
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);

      await userVault.setIsExternalRedemptionPaused(true);
      expect(await userVault.isExternalRedemptionPaused()).to.be.true;

      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.To,
      );

      const borrowAccount = { owner: userVault.address, number: borrowAccountNumber };
      expect(await core.dolomiteMargin.getAccountNumberOfMarketsWithDebt(borrowAccount)).to.eq(0);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        otherMarketId2,
        otherAmountWei,
      );
    });

    it('should fail when paused and debt is increased', async () => {
      await factory.setAllowableDebtMarketIds([]);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.None,
      );
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);

      await userVault.setIsExternalRedemptionPaused(true);
      expect(await userVault.isExternalRedemptionPaused()).to.be.true;

      await expectThrow(
        userVault.transferFromPositionWithOtherToken(
          borrowAccountNumber,
          defaultAccountNumber,
          otherMarketId1,
          otherAmountWei,
          BalanceCheckFlag.To,
        ),
        'IsolationModeVaultV1Pausable: Cannot lever up when paused',
      );

      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);
    });

    it('should fail when paused and collateralization is decreased', async () => {
      await factory.setAllowableDebtMarketIds([]);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.None,
      );
      const borrowAmount = otherAmountWei.div(2);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        borrowAmount,
        BalanceCheckFlag.None,
      );

      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, borrowAmount.mul(-1));
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, otherAmountWei);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei.add(borrowAmount),
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);

      await userVault.setIsExternalRedemptionPaused(true);
      expect(await userVault.isExternalRedemptionPaused()).to.be.true;

      await expectThrow(
        userVault.transferFromPositionWithOtherToken(
          borrowAccountNumber,
          defaultAccountNumber,
          otherMarketId2,
          borrowAmount,
          BalanceCheckFlag.To,
        ),
        'IsolationModeVaultV1Pausable: Cannot lever up when paused',
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

    it('should fail if vault is frozen', async () => {
      await freezeVault();
      await expectThrow(
        userVault.transferFromPositionWithOtherToken(
          borrowAccountNumber,
          defaultAccountNumber,
          0,
          amountWei,
          BalanceCheckFlag.Both,
        ),
        'IsolationModeVaultV1Freezable: Vault is frozen',
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

    it('should fail when not called by owner or converter', async () => {
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

    it('should fail if vault is frozen', async () => {
      await freezeVault();
      await expectThrow(
        userVault.repayAllForBorrowPosition(
          defaultAccountNumber,
          borrowAccountNumber,
          otherMarketId1,
          BalanceCheckFlag.Both,
        ),
        'IsolationModeVaultV1Freezable: Vault is frozen',
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

    // it('should work normally for isolation unwrapper', async () => {
    //   await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

    //   await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, amountWei);
    //   await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, ZERO_BI);
    //   await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);
    //   await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
    //   await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);
    //   await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, ZERO_BI);

    //   const outputAmount = otherAmountWei.div(2);
    //   const zapParams = await getUnwrapZapParams(
    //     underlyingMarketId,
    //     amountWei,
    //     otherMarketId1,
    //     outputAmount,
    //     tokenUnwrapper,
    //     core,
    //   );
    //   await userVault.connect(unwrapperImpersonator).addCollateralAndSwapExactInputForOutput(
    //     defaultAccountNumber,
    //     borrowAccountNumber,
    //     zapParams.marketIdsPath,
    //     zapParams.inputAmountWei,
    //     zapParams.minOutputAmountWei,
    //     zapParams.tradersPath,
    //     zapParams.makerAccounts,
    //     zapParams.userConfig,
    //   );

    //   await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
    //   await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, ZERO_BI);
    //   await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);
    //   await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, outputAmount);
    //   await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);
    //   await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, ZERO_BI);
    // });

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
        'IsolationModeVaultV1Freezable: Vault is frozen',
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

    it('should fail if external redemption is paused and user has debt', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.To,
      );
      await userVault.setIsExternalRedemptionPaused(true);

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
        'IsolationModeVaultV1Pausable: Cannot execute when paused',
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
        'IsolationModeVaultV1Freezable: Vault is frozen',
      );
    });
  });

  describe('#swapExactInputForOutput', () => {
    it('should work normally when not paused or frozen', async () => {
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

    it('should work when paused and repaying debt with collateral within slippage tolerance', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.To,
      );
      await userVault.setIsExternalRedemptionPaused(true);

      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei.mul(2));
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, otherAmountWei.mul(-1));
      expect(await userVault.isExternalRedemptionPaused()).to.be.true;

      const inputAmount = otherAmountWei.div(2);
      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, inputAmount, otherMarketId2, outputAmount, core);
      await userVault.swapExactInputForOutput(
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );

      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(
        core,
        userVault,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei.sub(inputAmount),
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei.mul(2));
      await expectProtocolBalance(
        core,
        userVault,
        borrowAccountNumber,
        otherMarketId2,
        outputAmount.sub(otherAmountWei),
      );
    });

    it('should work when paused and repaying debt with collateral within slippage tolerance', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.To,
      );
      await userVault.setIsExternalRedemptionPaused(true);

      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei.mul(2));
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, otherAmountWei.mul(-1));
      expect(await userVault.isExternalRedemptionPaused()).to.be.true;

      const inputAmount = otherAmountWei;
      const outputAmount = otherAmountWei;
      const zapParams = await getSimpleZapParams(otherMarketId1, inputAmount, otherMarketId2, outputAmount, core);
      await userVault.swapExactInputForOutput(
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );

      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(
        core,
        userVault,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei.sub(inputAmount),
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei.mul(2));
      await expectProtocolBalance(
        core,
        userVault,
        borrowAccountNumber,
        otherMarketId2,
        outputAmount.sub(otherAmountWei),
      );
    });

    it('should fail when swapping to underlying when paused', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.To,
      );
      await userVault.setIsExternalRedemptionPaused(true);

      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei.mul(2));
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, otherAmountWei.mul(-1));
      expect(await userVault.isExternalRedemptionPaused()).to.be.true;

      const inputAmount = otherAmountWei.div(2);
      const zapParams = await getWrapZapParams(
        otherMarketId1,
        inputAmount,
        underlyingMarketId,
        ONE_ETH_BI,
        tokenWrapper,
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
        `IsolationModeVaultV1Pausable: Cannot zap to market when paused <${underlyingMarketId.toString()}>`,
      );
    });

    it('should fail when output market is not repaying debt when paused', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.To,
      );
      await userVault.setIsExternalRedemptionPaused(true);

      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei.mul(2));
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, otherAmountWei.mul(-1));
      expect(await userVault.isExternalRedemptionPaused()).to.be.true;

      const inputAmount = otherAmountWei.div(2);
      const outputAmount = amountWei.div(2);
      const zapParams = await getSimpleZapParams(
        otherMarketId2,
        inputAmount,
        otherMarketId1,
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
        'IsolationModeVaultV1Pausable: Zaps can only repay when paused',
      );
    });

    it('should fail when input market goes negative when paused', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      const borrowAmount = otherAmountWei.div(10);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId2,
        borrowAmount,
        BalanceCheckFlag.To,
      );
      await userVault.setIsExternalRedemptionPaused(true);

      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        otherMarketId2,
        otherAmountWei.add(borrowAmount),
      );
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, borrowAmount.mul(-1));
      expect(await userVault.isExternalRedemptionPaused()).to.be.true;

      const inputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(
        otherMarketId1,
        inputAmount,
        otherMarketId2,
        inputAmount,
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
        `IsolationModeVaultV1Pausable: Cannot lever up when paused <${otherMarketId1.toString()}>`,
      );
    });

    it('should fail when input market goes negative when paused', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
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
      await userVault.setIsExternalRedemptionPaused(true);

      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, amountWei);
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
      expect(await userVault.isExternalRedemptionPaused()).to.be.true;

      const inputAmount = otherAmountWei.div(2);
      const outputAmount = otherAmountWei.div(10);
      const zapParams = await getSimpleZapParams(
        otherMarketId1,
        inputAmount,
        otherMarketId2,
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
        'IsolationModeVaultV1Pausable: Unacceptable trade when paused',
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

    it('should fail if vault is frozen', async () => {
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
        'IsolationModeVaultV1Freezable: Vault is frozen',
      );
    });
  });

  describe('#executeDepositIntoVault', () => {
    it('should fail when not called by factory', async () => {
      await expectThrow(
        userVault.connect(core.hhUser1).executeDepositIntoVault(core.hhUser1.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeWithdrawalFromVault', () => {
    it('should fail when not called by factory', async () => {
      await expectThrow(
        userVault.connect(core.hhUser1).executeWithdrawalFromVault(core.hhUser1.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});
