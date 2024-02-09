import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber, ContractTransaction } from 'ethers';
import {
  CustomTestToken,
  TestFreezableIsolationModeVaultFactory,
  TestHandlerRegistry,
  TestIsolationModeTokenVaultV1WithFreezable,
  TestIsolationModeTokenVaultV1WithFreezable__factory,
  TestIsolationModeUnwrapperTraderV2,
  TestIsolationModeUnwrapperTraderV2__factory,
  TestIsolationModeWrapperTraderV2,
  TestIsolationModeWrapperTraderV2__factory,
} from '../../../src/types';
import {
  createContractWithAbi,
  createContractWithLibrary,
  createTestToken,
  depositIntoDolomiteMargin,
} from '../../../src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectThrow,
} from '../../utils/assertions';
import { createIsolationModeTokenVaultV1ActionsImpl } from '../../utils/dolomite';
import {
  createTestFreezableIsolationModeVaultFactory,
  createTestHandlerRegistry,
} from '../../utils/ecosystem-utils/testers';
import {
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '../../utils/setup';
import { CoreProtocolArbitrumOne } from '../../utils/core-protocol';
import { parseEther } from 'ethers/lib/utils';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10
const bigOtherAmountWei = BigNumber.from('100000000000'); // $100,000

enum FreezeType {
  Deposit = 0,
  Withdrawal = 1,
}

const PLUS_ONE_BI = {
  sign: true,
  value: ONE_BI,
};

const MINUS_ONE_BI = {
  sign: false,
  value: ONE_BI,
};

const EXECUTION_FEE = ONE_ETH_BI.div(4);

describe('FreezableIsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: CustomTestToken;
  let underlyingMarketId: BigNumber;
  let tokenUnwrapper: TestIsolationModeUnwrapperTraderV2;
  let tokenWrapper: TestIsolationModeWrapperTraderV2;
  let factory: TestFreezableIsolationModeVaultFactory;
  let userVaultImplementation: TestIsolationModeTokenVaultV1WithFreezable;
  let userVault: TestIsolationModeTokenVaultV1WithFreezable;
  let impersonatedVault: SignerWithAddress;
  let registry: TestHandlerRegistry;

  let solidUser: SignerWithAddress;
  let otherToken1: CustomTestToken;
  let otherToken2: CustomTestToken;
  let otherMarketId1: BigNumber;
  let otherMarketId2: BigNumber;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    underlyingToken = await createTestToken();
    const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
    userVaultImplementation = await createContractWithLibrary<TestIsolationModeTokenVaultV1WithFreezable>(
      'TestIsolationModeTokenVaultV1WithFreezable',
      libraries,
      [core.tokens.weth.address],
    );
    registry = await createTestHandlerRegistry(core);
    factory = await createTestFreezableIsolationModeVaultFactory(
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
    await factory.connect(core.governance).ownerInitialize([tokenUnwrapper.address, tokenWrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    userVault = setupUserVaultProxy<TestIsolationModeTokenVaultV1WithFreezable>(
      vaultAddress,
      TestIsolationModeTokenVaultV1WithFreezable__factory,
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

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  async function freezeVault(
    accountNumber: BigNumber = ZERO_BI
  ): Promise<ContractTransaction> {
    return factory.connect(impersonatedVault).setVaultAccountPendingAmountForFrozenStatus(
      userVault.address,
      accountNumber,
      FreezeType.Deposit,
      PLUS_ONE_BI,
      core.tokens.usdc.address
    );
  }

  describe('#constructor', () => {
    it('should work', async () => {
      expect(await factory.handlerRegistry()).to.eq(registry.address);
      expect(await factory.executionFee()).to.eq(EXECUTION_FEE);
    });
  });

  describe('#ownerSetExecutionFee', () => {
    it('should work normally', async () => {
      const newFee = ONE_ETH_BI.div(2);
      const result = await factory.connect(core.governance).ownerSetExecutionFee(newFee);
      await expectEvent(factory, result, 'ExecutionFeeSet', {
        executionFee: newFee
      });
      expect(await factory.executionFee()).to.eq(newFee);
    });

    it('should fail if greater than max', async () => {
      await expectThrow(
        factory.connect(core.governance).ownerSetExecutionFee(parseEther('1000')),
        'FreezableVaultFactory: Invalid execution fee',
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        factory.connect(core.hhUser2).ownerSetExecutionFee(ONE_ETH_BI),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetMaxExecutionFee', () => {
    it('should work normally', async () => {
      const newMaxFee = ONE_ETH_BI.div(2);
      const result = await factory.connect(core.governance).ownerSetMaxExecutionFee(newMaxFee);
      await expectEvent(factory, result, 'MaxExecutionFeeSet', {
        maxExecutionFee: newMaxFee
      });
      expect(await factory.maxExecutionFee()).to.eq(newMaxFee);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        factory.connect(core.hhUser2).ownerSetMaxExecutionFee(ONE_ETH_BI),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetHandlerRegistry', () => {
    it('should work normally', async () => {
      const newRegistry = await createTestHandlerRegistry(core);
      const result = await factory.connect(core.governance).ownerSetHandlerRegistry(newRegistry.address);
      await expectEvent(factory, result, 'HandlerRegistrySet', {
        handlerRegistry: newRegistry.address
      });
      expect(await factory.handlerRegistry()).to.eq(newRegistry.address);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        factory.connect(core.hhUser2).ownerSetHandlerRegistry(core.dolomiteRegistry.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setIsVaultDepositSourceWrapper', () => {
    it('should work normally', async () => {
      const wrapperImpersonator = await impersonate(tokenWrapper.address, true);
      await factory.connect(wrapperImpersonator).setIsVaultDepositSourceWrapper(userVault.address, true);
      expect(await userVault.isDepositSourceWrapper()).to.be.true;
    });

    it('should fail if invalid vault address', async () => {
      const wrapperImpersonator = await impersonate(tokenWrapper.address, true);
      await expectThrow(
        factory.connect(wrapperImpersonator).setIsVaultDepositSourceWrapper(core.hhUser1.address, true),
        `IsolationModeVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if not token coverter', async () => {
      await expectThrow(
        factory.connect(core.hhUser2).setIsVaultDepositSourceWrapper(userVault.address, true),
        `IsolationModeVaultFactory: Caller is not a token converter <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setShouldVaultSkipTransfer', () => {
    it('should work normally', async () => {
      const wrapperImpersonator = await impersonate(tokenWrapper.address, true);
      await factory.connect(wrapperImpersonator).setShouldVaultSkipTransfer(userVault.address, true);
      expect(await userVault.shouldSkipTransfer()).to.be.true;
    });

    it('should fail if invalid vault address', async () => {
      const wrapperImpersonator = await impersonate(tokenWrapper.address, true);
      await expectThrow(
        factory.connect(wrapperImpersonator).setShouldVaultSkipTransfer(core.hhUser1.address, true),
        `IsolationModeVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if not token coverter', async () => {
      await expectThrow(
        factory.connect(core.hhUser2).setShouldVaultSkipTransfer(userVault.address, true),
        `IsolationModeVaultFactory: Caller is not a token converter <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setVaultAccountPendingAmountForFrozenStatus', () => {
    it('should work normally with positive deposit', async () => {
      const result = await factory.connect(core.governance).setVaultAccountPendingAmountForFrozenStatus(
        userVault.address,
        defaultAccountNumber,
        FreezeType.Deposit,
        PLUS_ONE_BI,
        core.tokens.usdc.address
      );
      await expectEvent(factory, result, 'VaultAccountFrozen', {
        vault: userVault.address,
        accountNumber: defaultAccountNumber,
        isFrozen: true,
      });
      
      expect(await factory.isVaultFrozen(userVault.address)).to.be.true;
      expect(await factory.getPendingAmountByAccount(userVault.address, defaultAccountNumber, FreezeType.Deposit)).to.eq(ONE_BI);
      expect(await factory.getPendingAmountByVault(userVault.address, FreezeType.Deposit)).to.eq(ONE_BI);
      expect(await factory.getOutputTokenByAccount(userVault.address, defaultAccountNumber)).to.eq(core.tokens.usdc.address);
      expect(await factory.isVaultAccountFrozen(userVault.address, defaultAccountNumber)).to.be.true;
    });

    it('should work normally with positive deposit then negative', async () => {
      await factory.connect(core.governance).setVaultAccountPendingAmountForFrozenStatus(
        userVault.address,
        defaultAccountNumber,
        FreezeType.Deposit,
        PLUS_ONE_BI,
        core.tokens.usdc.address
      );
      await factory.connect(core.governance).setVaultAccountPendingAmountForFrozenStatus(
        userVault.address,
        defaultAccountNumber,
        FreezeType.Deposit,
        MINUS_ONE_BI,
        core.tokens.usdc.address
      );
      
      expect(await factory.isVaultFrozen(userVault.address)).to.be.false;
      expect(await factory.getPendingAmountByAccount(userVault.address, defaultAccountNumber, FreezeType.Deposit)).to.eq(ZERO_BI);
      expect(await factory.getPendingAmountByVault(userVault.address, FreezeType.Deposit)).to.eq(ZERO_BI);
      expect(await factory.getOutputTokenByAccount(userVault.address, defaultAccountNumber)).to.eq(ADDRESS_ZERO);
      expect(await factory.isVaultAccountFrozen(userVault.address, defaultAccountNumber)).to.be.false;
    });

    it('should work normally with positive withdrawal', async () => {
      const result = await factory.connect(core.governance).setVaultAccountPendingAmountForFrozenStatus(
        userVault.address,
        defaultAccountNumber,
        FreezeType.Withdrawal,
        PLUS_ONE_BI,
        core.tokens.usdc.address
      );
      await expectEvent(factory, result, 'VaultAccountFrozen', {
        vault: userVault.address,
        accountNumber: defaultAccountNumber,
        isFrozen: true,
      });
      
      expect(await factory.isVaultFrozen(userVault.address)).to.be.true;
      expect(await factory.getPendingAmountByAccount(userVault.address, defaultAccountNumber, FreezeType.Withdrawal)).to.eq(ONE_BI);
      expect(await factory.getPendingAmountByVault(userVault.address, FreezeType.Withdrawal)).to.eq(ONE_BI);
      expect(await factory.getOutputTokenByAccount(userVault.address, defaultAccountNumber)).to.eq(core.tokens.usdc.address);
      expect(await factory.isVaultAccountFrozen(userVault.address, defaultAccountNumber)).to.be.true;
    });

    it('should work normally with positive withdrawal then negative', async () => {
      await factory.connect(core.governance).setVaultAccountPendingAmountForFrozenStatus(
        userVault.address,
        defaultAccountNumber,
        FreezeType.Withdrawal,
        PLUS_ONE_BI,
        core.tokens.usdc.address
      );
      await factory.connect(core.governance).setVaultAccountPendingAmountForFrozenStatus(
        userVault.address,
        defaultAccountNumber,
        FreezeType.Withdrawal,
        MINUS_ONE_BI,
        core.tokens.usdc.address
      );
      
      expect(await factory.isVaultFrozen(userVault.address)).to.be.false;
      expect(await factory.getPendingAmountByAccount(userVault.address, defaultAccountNumber, FreezeType.Deposit)).to.eq(ZERO_BI);
      expect(await factory.getPendingAmountByVault(userVault.address, FreezeType.Deposit)).to.eq(ZERO_BI);
      expect(await factory.getOutputTokenByAccount(userVault.address, defaultAccountNumber)).to.eq(ADDRESS_ZERO);
      expect(await factory.isVaultAccountFrozen(userVault.address, defaultAccountNumber)).to.be.false;
    });

    it('should fail if expectedConversionToken is not conversion token', async () => {
      await factory.connect(core.governance).setVaultAccountPendingAmountForFrozenStatus(
        userVault.address,
        defaultAccountNumber,
        FreezeType.Withdrawal,
        PLUS_ONE_BI,
        core.tokens.usdc.address
      );
      await expectThrow(
        factory.connect(core.governance).setVaultAccountPendingAmountForFrozenStatus(
          userVault.address,
          defaultAccountNumber,
          FreezeType.Withdrawal,
          MINUS_ONE_BI,
          core.tokens.weth.address
        ),
        `FreezableVaultFactory: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should work normally with zero', async () => {
      await factory.connect(core.governance).setVaultAccountPendingAmountForFrozenStatus(
        userVault.address,
        defaultAccountNumber,
        FreezeType.Withdrawal,
        { sign: false, value: ZERO_BI },
        core.tokens.usdc.address
      );
      expect(await factory.isVaultFrozen(userVault.address)).to.be.false;
      expect(await factory.getOutputTokenByAccount(userVault.address, defaultAccountNumber)).to.eq(ADDRESS_ZERO);
      expect(await factory.isVaultAccountFrozen(userVault.address, defaultAccountNumber)).to.be.false;
    });

    it('should fail if not token converter, vault, or dolomite margin owner', async () => {
      const wrapperImpersonator = await impersonate(tokenWrapper.address, true);
      const vaultImpersonator = await impersonate(userVault.address, true);
      await factory.connect(core.governance).setVaultAccountPendingAmountForFrozenStatus(
        userVault.address,
        defaultAccountNumber,
        FreezeType.Deposit,
        PLUS_ONE_BI,
        core.tokens.usdc.address
      );
      await factory.connect(wrapperImpersonator).setVaultAccountPendingAmountForFrozenStatus(
        userVault.address,
        defaultAccountNumber,
        FreezeType.Deposit,
        PLUS_ONE_BI,
        core.tokens.usdc.address
      );
      await factory.connect(vaultImpersonator).setVaultAccountPendingAmountForFrozenStatus(
        userVault.address,
        defaultAccountNumber,
        FreezeType.Deposit,
        PLUS_ONE_BI,
        core.tokens.usdc.address
      );
      await expectThrow(
        factory.connect(core.hhUser2).setVaultAccountPendingAmountForFrozenStatus(
          userVault.address,
          defaultAccountNumber,
          FreezeType.Deposit,
          PLUS_ONE_BI,
          core.tokens.usdc.address
        ),
        `FreezableVaultFactory: Caller is not a authorized <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail if invalid vault', async () => {
      await expectThrow(
        factory.connect(core.governance).setVaultAccountPendingAmountForFrozenStatus(
          core.hhUser1.address,
          defaultAccountNumber,
          FreezeType.Deposit,
          PLUS_ONE_BI,
          core.tokens.usdc.address
        ),
        `IsolationModeVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#depositIntoDolomiteMarginFromTokenConverter', () => {
    it('should work normally', async () => {
      const wrapperImpersonator = await impersonate(tokenWrapper.address, true);
      await factory.connect(core.governance).setVaultAccountPendingAmountForFrozenStatus(
        userVault.address,
        defaultAccountNumber,
        FreezeType.Deposit,
        PLUS_ONE_BI,
        core.tokens.usdc.address
      );
      await factory.connect(wrapperImpersonator).setShouldVaultSkipTransfer(userVault.address, true);
      await factory.connect(wrapperImpersonator).depositIntoDolomiteMarginFromTokenConverter(
        userVault.address,
        ZERO_BI,
        ONE_ETH_BI
      );
      await expectProtocolBalance(core, userVault.address, ZERO_BI, underlyingMarketId, ONE_ETH_BI);
    });

    it('should fail if not token converter', async () => {
      await expectThrow(
        factory.connect(core.hhUser2).depositIntoDolomiteMarginFromTokenConverter(
          userVault.address,
          ZERO_BI,
          ONE_ETH_BI
        ),
        `IsolationModeVaultFactory: Caller is not a token converter <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail if invalid vault', async () => {
      const wrapperImpersonator = await impersonate(tokenWrapper.address, true);
      await expectThrow(
        factory.connect(wrapperImpersonator).depositIntoDolomiteMarginFromTokenConverter(
          core.hhUser1.address,
          ZERO_BI,
          ONE_ETH_BI
        ),
        `IsolationModeVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});
