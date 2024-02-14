import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber, BigNumberish, ContractTransaction, ethers } from 'ethers';
import {
  CustomTestToken,
  IsolationModeTokenVaultV1,
  IsolationModeTokenVaultV1__factory,
  IsolationModeUpgradeableProxy,
  IsolationModeUpgradeableProxy__factory,
  TestIsolationModeFactory,
  TestIsolationModeTokenVaultV1,
  TestIsolationModeTokenVaultV1__factory,
  TestIsolationModeUnwrapperTraderV1,
  TestIsolationModeUnwrapperTraderV1__factory,
  TestIsolationModeUnwrapperTraderV2,
  TestIsolationModeUnwrapperTraderV2__factory,
  TestIsolationModeWrapperTraderV1,
  TestIsolationModeWrapperTraderV1__factory,
  TestIsolationModeWrapperTraderV2,
  TestIsolationModeWrapperTraderV2__factory,
} from '../../../src/types';
import { createContractWithAbi, createContractWithLibrary, createTestToken } from '../../../src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectThrow,
  expectTotalSupply,
  expectWalletAllowance,
  expectWalletBalance,
} from '../../utils/assertions';
import { CoreProtocolArbitrumOne } from '../../utils/core-protocol';
import { createIsolationModeTokenVaultV1ActionsImpl } from '../../utils/dolomite';
import { createTestIsolationModeFactory } from '../../utils/ecosystem-utils/testers';
import {
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '../../utils/setup';

const toAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // 200 units
const smallAmountWei = BigNumber.from('10000000000000000000'); // 10 units

describe('IsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: CustomTestToken;
  let underlyingMarketId: BigNumber;
  let otherToken: CustomTestToken;
  let otherMarketId: BigNumber;
  let rewardToken: CustomTestToken;
  let rewardMarketId: BigNumber;
  let tokenUnwrapperV1: TestIsolationModeUnwrapperTraderV1;
  let tokenWrapperV1: TestIsolationModeWrapperTraderV1;
  let tokenUnwrapperV2: TestIsolationModeUnwrapperTraderV2;
  let tokenWrapperV2: TestIsolationModeWrapperTraderV2;
  let factory: TestIsolationModeFactory;
  let userVaultImplementation: TestIsolationModeTokenVaultV1;
  let initializeResult: ContractTransaction;

  let solidAccount: SignerWithAddress;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    underlyingToken = await createTestToken();
    otherToken = await createTestToken();
    const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
    userVaultImplementation = await createContractWithLibrary<TestIsolationModeTokenVaultV1>(
      'TestIsolationModeTokenVaultV1',
      libraries,
      [],
    );
    factory = await createTestIsolationModeFactory(core, underlyingToken, userVaultImplementation);
    await core.testEcosystem!.testPriceOracle.setPrice(
      factory.address,
      '1000000000000000000', // $1.00
    );
    await core.testEcosystem!.testPriceOracle.setPrice(
      otherToken.address,
      '1000000000000000000', // $1.00
    );

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);

    otherMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken, false);

    rewardToken = await createTestToken();
    await core.testEcosystem!.testPriceOracle.setPrice(
      rewardToken.address,
      '1000000000000000000', // $1.00
    );
    rewardMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, rewardToken, false);

    tokenUnwrapperV1 = await createContractWithAbi<TestIsolationModeUnwrapperTraderV1>(
      TestIsolationModeUnwrapperTraderV1__factory.abi,
      TestIsolationModeUnwrapperTraderV1__factory.bytecode,
      [otherToken.address, factory.address, core.dolomiteMargin.address],
    );
    tokenUnwrapperV2 = await createContractWithAbi<TestIsolationModeUnwrapperTraderV2>(
      TestIsolationModeUnwrapperTraderV2__factory.abi,
      TestIsolationModeUnwrapperTraderV2__factory.bytecode,
      [otherToken.address, factory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address],
    );
    tokenWrapperV1 = await createContractWithAbi<TestIsolationModeWrapperTraderV1>(
      TestIsolationModeWrapperTraderV1__factory.abi,
      TestIsolationModeWrapperTraderV1__factory.bytecode,
      [factory.address, core.dolomiteMargin.address],
    );
    tokenWrapperV2 = await createContractWithAbi<TestIsolationModeWrapperTraderV2>(
      TestIsolationModeWrapperTraderV2__factory.abi,
      TestIsolationModeWrapperTraderV2__factory.bytecode,
      [otherToken.address, factory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address],
    );
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(tokenWrapperV1.address, true);
    initializeResult = await factory.connect(core.governance).ownerInitialize([
      tokenUnwrapperV1.address,
      tokenWrapperV1.address,
      tokenUnwrapperV2.address,
      tokenWrapperV2.address,
    ]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    solidAccount = core.hhUser5;

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  async function createUninitializedFactory() {
    return createTestIsolationModeFactory(core, underlyingToken, userVaultImplementation);
  }

  async function checkVaultCreationResults(result: ContractTransaction) {
    const vault = await factory.getVaultByAccount(core.hhUser1.address);
    const account = await factory.getAccountByVault(vault);
    expect(account).to.eq(core.hhUser1.address);
    await expectEvent(factory, result, 'VaultCreated', {
      account: core.hhUser1.address,
      vault: vault.toString(),
    });
    await expect(await core.borrowPositionProxyV2.isCallerAuthorized(vault)).to.eq(true);

    const vaultContract = setupUserVaultProxy<IsolationModeUpgradeableProxy>(
      vault,
      IsolationModeUpgradeableProxy__factory,
      core.hhUser1,
    );
    expect(await vaultContract.isInitialized()).to.eq(true);
    expect(await vaultContract.owner()).to.eq(core.hhUser1.address);
  }

  describe('#initialize', () => {
    it('should work when deployed normally', async () => {
      await expectEvent(factory, initializeResult, 'Initialized', {});
      await expectEvent(factory, initializeResult, 'TokenConverterSet', {
        tokenConverter: tokenUnwrapperV1.address,
        isTrusted: true,
      });
      expect(await factory.marketId()).to.eq(underlyingMarketId);
      expect(await factory.isInitialized()).to.eq(true);
      expect(await factory.isTokenConverterTrusted(tokenUnwrapperV1.address)).to.eq(true);
      expect(await factory.isTokenConverterTrusted(tokenWrapperV1.address)).to.eq(true);
      expect(await factory.isTokenConverterTrusted(tokenUnwrapperV2.address)).to.eq(true);
      expect(await factory.isTokenConverterTrusted(tokenWrapperV2.address)).to.eq(true);
    });

    it('should fail when already initialized', async () => {
      await expectThrow(
        factory.connect(core.governance).ownerInitialize([]),
        'IsolationModeVaultFactory: Already initialized',
      );
    });

    it('should fail when not called by DolomiteMargin owner', async () => {
      const badFactory = await createTestIsolationModeFactory(core, underlyingToken, userVaultImplementation);
      await core.testEcosystem!.testPriceOracle.setPrice(
        badFactory.address,
        '1000000000000000000', // $1.00
      );
      await core.dolomiteMargin.connect(core.governance).ownerAddMarket(
        badFactory.address,
        core.testEcosystem!.testPriceOracle.address,
        core.testEcosystem!.testInterestSetter.address,
        { value: 0 },
        { value: 0 },
        0,
        false,
        false,
      );

      await expectThrow(
        badFactory.connect(core.hhUser1).ownerInitialize([]),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when market allows borrowing', async () => {
      const badFactory = await createTestIsolationModeFactory(core, underlyingToken, userVaultImplementation);
      await core.testEcosystem!.testPriceOracle.setPrice(
        badFactory.address,
        '1000000000000000000', // $1.00
      );
      await core.dolomiteMargin.connect(core.governance).ownerAddMarket(
        badFactory.address,
        core.testEcosystem!.testPriceOracle.address,
        core.testEcosystem!.testInterestSetter.address,
        { value: 0 },
        { value: 0 },
        0,
        false,
        false,
      );

      await expectThrow(
        badFactory.connect(core.governance).ownerInitialize([]),
        'IsolationModeVaultFactory: Market cannot allow borrowing',
      );
    });
  });

  describe('#createVault', () => {
    it('should work under normal conditions', async () => {
      const result = await factory.connect(core.hhUser1).createVault(core.hhUser1.address);
      await checkVaultCreationResults(result);
    });

    it('should work when a different wallet creates vault for other', async () => {
      const result = await factory.connect(core.governance).createVault(core.hhUser1.address);
      await checkVaultCreationResults(result);
    });

    it('should fail when account passed is the zero address', async () => {
      await expectThrow(
        factory.createVault(ZERO_ADDRESS),
        'IsolationModeVaultFactory: Invalid account',
      );
    });

    it('should fail when vault is already created', async () => {
      const result = await factory.createVault(core.hhUser1.address);
      await checkVaultCreationResults(result);

      await expectThrow(
        factory.createVault(core.hhUser1.address),
        'IsolationModeVaultFactory: Vault already exists',
      );
    });

    it('should fail when factory is not initialized', async () => {
      const uninitializedFactory = await createUninitializedFactory();
      await expectThrow(
        uninitializedFactory.createVault(core.hhUser1.address),
        'IsolationModeVaultFactory: Not initialized',
      );
    });
  });

  describe('#createVaultAndDepositIntoDolomiteMargin', () => {
    it('should work under normal conditions', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      const vaultAddress = await factory.calculateVaultByAccount(core.hhUser1.address);
      await underlyingToken.connect(core.hhUser1).approve(vaultAddress, amountWei);

      const result = await factory.connect(core.hhUser1).createVaultAndDepositIntoDolomiteMargin(
        toAccountNumber,
        amountWei,
      );
      await checkVaultCreationResults(result);
      await expectProtocolBalance(core, core.hhUser1.address, toAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, vaultAddress, toAccountNumber, underlyingMarketId, amountWei);
      await expectWalletBalance(core.dolomiteMargin.address, factory, amountWei);
    });

    it('should fail when vault is already created', async () => {
      const result = await factory.createVault(core.hhUser1.address);
      await checkVaultCreationResults(result);

      await expectThrow(
        factory.connect(core.hhUser1).createVaultAndDepositIntoDolomiteMargin(toAccountNumber, amountWei),
        'IsolationModeVaultFactory: Vault already exists',
      );
    });

    it('should fail when factory is not initialized', async () => {
      const uninitializedFactory = await createUninitializedFactory();
      await expectThrow(
        uninitializedFactory.connect(core.hhUser1).createVaultAndDepositIntoDolomiteMargin(toAccountNumber, amountWei),
        'IsolationModeVaultFactory: Not initialized',
      );
    });
  });

  describe('#ownerSetUserVaultImplementation', () => {
    it('should work when called by governance', async () => {
      const newImplementation = await createContractWithAbi(
        IsolationModeUpgradeableProxy__factory.abi,
        IsolationModeUpgradeableProxy__factory.bytecode,
        [],
      );
      const result = await factory.connect(core.governance)
        .ownerSetUserVaultImplementation(newImplementation.address);
      expect(await factory.userVaultImplementation()).to.eq(newImplementation.address);
      await expectEvent(factory, result, 'UserVaultImplementationSet', {
        previousUserVaultImplementation: userVaultImplementation.address,
        newUserVaultImplementation: newImplementation.address,
      });
    });

    it('should fail when not called by owner', async () => {
      const newImplementation = await createContractWithAbi(
        IsolationModeUpgradeableProxy__factory.abi,
        IsolationModeUpgradeableProxy__factory.bytecode,
        [],
      );
      await expectThrow(
        factory.connect(core.hhUser1).ownerSetUserVaultImplementation(newImplementation.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when not not initialized', async () => {
      const newImplementation = await createContractWithAbi(
        IsolationModeUpgradeableProxy__factory.abi,
        IsolationModeUpgradeableProxy__factory.bytecode,
        [],
      );
      const uninitializedFactory = await createUninitializedFactory();
      await expectThrow(
        uninitializedFactory.ownerSetUserVaultImplementation(newImplementation.address),
        'IsolationModeVaultFactory: Not initialized',
      );
    });

    it('should fail when user vault implementation is not valid', async () => {
      await expectThrow(
        factory.connect(core.governance).ownerSetUserVaultImplementation(ZERO_ADDRESS),
        'IsolationModeVaultFactory: Invalid user implementation',
      );
    });
  });

  describe('#ownerSetIsTokenConverterTrusted', () => {
    it('should work when called by governance', async () => {
      const newConverter = await createContractWithAbi(
        IsolationModeUpgradeableProxy__factory.abi,
        IsolationModeUpgradeableProxy__factory.bytecode,
        [],
      );
      const result1 = await factory.connect(core.governance)
        .ownerSetIsTokenConverterTrusted(newConverter.address, true);
      expect(await factory.isTokenConverterTrusted(newConverter.address)).to.eq(true);
      await expectEvent(factory, result1, 'TokenConverterSet', {
        tokenConverter: newConverter.address,
        isTrusted: true,
      });

      const result2 = await factory.connect(core.governance)
        .ownerSetIsTokenConverterTrusted(newConverter.address, false);
      expect(await factory.isTokenConverterTrusted(newConverter.address)).to.eq(false);
      await expectEvent(factory, result2, 'TokenConverterSet', {
        tokenConverter: newConverter.address,
        isTrusted: false,
      });
    });

    it('should fail when not called by owner', async () => {
      const newConverter = await createContractWithAbi(
        IsolationModeUpgradeableProxy__factory.abi,
        IsolationModeUpgradeableProxy__factory.bytecode,
        [],
      );
      await expectThrow(
        factory.connect(core.hhUser1).ownerSetIsTokenConverterTrusted(newConverter.address, true),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when zero address is used', async () => {
      await expectThrow(
        factory.connect(core.governance).ownerSetIsTokenConverterTrusted(ZERO_ADDRESS, true),
        'IsolationModeVaultFactory: Invalid token converter',
      );
    });

    it('should fail when not not initialized', async () => {
      const newConverter = await createContractWithAbi(
        IsolationModeUpgradeableProxy__factory.abi,
        IsolationModeUpgradeableProxy__factory.bytecode,
        [],
      );
      const uninitializedFactory = await createUninitializedFactory();
      await expectThrow(
        uninitializedFactory.ownerSetIsTokenConverterTrusted(newConverter.address, true),
        'IsolationModeVaultFactory: Not initialized',
      );
    });
  });

  describe('#depositOtherTokenIntoDolomiteMarginForVaultOwner', () => {
    it('should work normally', async () => {
      await factory.connect(core.hhUser1).createVault(core.hhUser1.address);

      const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);

      const vault = setupUserVaultProxy<TestIsolationModeTokenVaultV1>(
        vaultAddress,
        TestIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );
      await rewardToken.addBalance(vault.address, amountWei);
      await vault.callDepositOtherTokenIntoDolomiteMarginForVaultOwner(
        toAccountNumber,
        rewardMarketId,
        amountWei,
      );

      await expectProtocolBalance(core, core.hhUser1.address, toAccountNumber, rewardMarketId, amountWei);
      await expectProtocolBalance(core, vaultAddress, 0, rewardMarketId, ZERO_BI);
      await expectProtocolBalance(core, vaultAddress, toAccountNumber, rewardMarketId, ZERO_BI);

      await expectWalletBalance(core.hhUser1, rewardToken, ZERO_BI);
      await expectWalletBalance(vaultAddress, rewardToken, ZERO_BI);
      await expectWalletBalance(core.dolomiteMargin.address, rewardToken, amountWei);

      await expectWalletAllowance(core.hhUser1, vault, rewardToken, ZERO_BI);
      await expectWalletAllowance(vault, core.dolomiteMargin.address, rewardToken, ZERO_BI);
    });

    it('should fail when invalid market ID sent', async () => {
      await factory.connect(core.hhUser1).createVault(core.hhUser1.address);
      const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
      const vault = await impersonate(vaultAddress, true);

      await expectThrow(
        factory.connect(vault)
          .depositOtherTokenIntoDolomiteMarginForVaultOwner(toAccountNumber, underlyingMarketId, amountWei),
        `IsolationModeVaultFactory: Invalid market <${underlyingMarketId.toString()}>`,
      );
    });

    it('should fail when not called by vault', async () => {
      await expectThrow(
        factory.connect(core.hhUser1)
          .depositOtherTokenIntoDolomiteMarginForVaultOwner(toAccountNumber, core.marketIds.weth, amountWei),
        `IsolationModeVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#enqueueTransferIntoDolomiteMargin', () => {
    async function executeWrapV1(
      vaultImplementation: SignerWithAddress,
      inputMarketId: BigNumberish,
      outputMarketId: BigNumberish,
      signer?: SignerWithAddress,
    ): Promise<ContractTransaction> {
      const solidAccountId = 0;
      const actions = await tokenWrapperV1.createActionsForWrapping(
        solidAccountId,
        /* _liquidAccountId = */ 0,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        outputMarketId,
        inputMarketId,
        ZERO_BI,
        smallAmountWei,
      );
      return core.dolomiteMargin
        .connect(signer ?? vaultImplementation)
        .operate([{ owner: vaultImplementation.address, number: toAccountNumber }], actions);
    }

    async function executeWrapV2(
      vaultImplementation: SignerWithAddress,
      inputMarketId: BigNumberish,
      outputMarketId: BigNumberish,
      signer?: SignerWithAddress,
    ): Promise<ContractTransaction> {
      const solidAccountId = 0;
      const actions = await tokenWrapperV2.createActionsForWrapping({
        primaryAccountId: solidAccountId,
        otherAccountId: ZERO_BI,
        primaryAccountOwner: solidAccount.address,
        primaryAccountNumber: ZERO_BI,
        otherAccountOwner: core.hhUser1.address,
        otherAccountNumber: ZERO_BI,
        outputMarket: outputMarketId,
        inputMarket: inputMarketId,
        minOutputAmount: ZERO_BI,
        inputAmount: smallAmountWei,
        orderData: BYTES_EMPTY,
      });
      return core.dolomiteMargin
        .connect(signer ?? vaultImplementation)
        .operate([{ owner: vaultImplementation.address, number: toAccountNumber }], actions);
    }

    it('should work when called by a V1 token converter', async () => {
      await factory.connect(core.hhUser1).createVault(core.hhUser1.address);

      const vault = await setupUserVaultProxy<TestIsolationModeTokenVaultV1>(
        await factory.getVaultByAccount(core.hhUser1.address),
        TestIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(toAccountNumber, amountWei);

      const vaultImplementation = await impersonate(vault.address, true);
      await otherToken.addBalance(core.dolomiteMargin.address, amountWei);
      expect(await factory.isTokenConverterTrusted(tokenWrapperV1.address)).to.eq(true);
      await expectThrow(
        executeWrapV1(vaultImplementation, otherMarketId, core.marketIds.weth),
        `IsolationModeWrapperTraderV1: Invalid output market <${core.marketIds.weth.toString()}>`,
      );
      await expectThrow(
        tokenWrapperV1.connect(core.hhUser1)
          .exchange(
            core.hhUser1.address,
            core.dolomiteMargin.address,
            underlyingToken.address,
            factory.address,
            amountWei,
            BYTES_EMPTY,
          ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
      const result = await executeWrapV1(vaultImplementation, otherMarketId, underlyingMarketId);

      const queuedTransfer = await factory.getQueuedTransferByCursor(2);
      expect(queuedTransfer.from).to.eq(tokenWrapperV1.address);
      expect(queuedTransfer.to).to.eq(core.dolomiteMargin.address);
      expect(queuedTransfer.amount).to.eq(smallAmountWei);
      expect(queuedTransfer.vault).to.eq(vault.address);

      await expectEvent(factory, result, 'TransferQueued', {
        transferCursor: 2,
        from: tokenWrapperV1.address,
        to: core.dolomiteMargin.address,
        amount: smallAmountWei,
        vault: vault.address,
      });

      const cumulativeBalance = amountWei.add(smallAmountWei);
      expect(await otherToken.balanceOf(tokenWrapperV1.address)).to.eq(smallAmountWei);
      expect(await underlyingToken.balanceOf(tokenWrapperV1.address)).to.eq(ZERO_BI);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(cumulativeBalance);
      expect(await factory.balanceOf(core.dolomiteMargin.address)).to.eq(cumulativeBalance);
      await expectProtocolBalance(core, vault.address, toAccountNumber, underlyingMarketId, cumulativeBalance);
    });

    it('should work when called by a V2 token converter', async () => {
      await factory.connect(core.hhUser1).createVault(core.hhUser1.address);

      const vault = await setupUserVaultProxy<TestIsolationModeTokenVaultV1>(
        await factory.getVaultByAccount(core.hhUser1.address),
        TestIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(toAccountNumber, amountWei);

      const vaultImplementation = await impersonate(vault.address, true);
      await otherToken.addBalance(core.dolomiteMargin.address, amountWei);
      expect(await factory.isTokenConverterTrusted(tokenWrapperV1.address)).to.eq(true);
      await expectThrow(
        executeWrapV2(vaultImplementation, otherMarketId, core.marketIds.weth),
        `IsolationModeWrapperTraderV2: Invalid output market <${core.marketIds.weth.toString()}>`,
      );
      await expectThrow(
        tokenWrapperV2.connect(core.hhUser1)
          .exchange(
            core.hhUser1.address,
            core.dolomiteMargin.address,
            underlyingToken.address,
            factory.address,
            amountWei,
            BYTES_EMPTY,
          ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
      const result = await executeWrapV2(vaultImplementation, otherMarketId, underlyingMarketId);

      const queuedTransfer = await factory.getQueuedTransferByCursor(2);
      expect(queuedTransfer.from).to.eq(tokenWrapperV2.address);
      expect(queuedTransfer.to).to.eq(core.dolomiteMargin.address);
      expect(queuedTransfer.amount).to.eq(smallAmountWei);
      expect(queuedTransfer.vault).to.eq(vault.address);

      await expectEvent(factory, result, 'TransferQueued', {
        transferCursor: 2,
        from: tokenWrapperV2.address,
        to: core.dolomiteMargin.address,
        amount: smallAmountWei,
        vault: vault.address,
      });

      const cumulativeBalance = amountWei.add(smallAmountWei);
      expect(await otherToken.balanceOf(tokenWrapperV2.address)).to.eq(smallAmountWei);
      expect(await underlyingToken.balanceOf(tokenWrapperV2.address)).to.eq(ZERO_BI);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(cumulativeBalance);
      expect(await factory.balanceOf(core.dolomiteMargin.address)).to.eq(cumulativeBalance);
      await expectProtocolBalance(core, vault.address, toAccountNumber, underlyingMarketId, cumulativeBalance);
    });

    it('should fail when not called by token converter', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).enqueueTransferIntoDolomiteMargin(core.hhUser1.address, amountWei),
        `IsolationModeVaultFactory: Caller is not a token converter <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should overwrite cursor if already queued', async () => {
      await factory.connect(core.hhUser1).createVault(core.hhUser1.address);
      const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);

      await factory.testEnqueueTransfer(
        vaultAddress,
        core.dolomiteMargin.address,
        amountWei,
        vaultAddress,
      );

      await factory.connect(core.governance).ownerSetIsTokenConverterTrusted(core.hhUser2.address, true);
      const result = await factory.connect(core.hhUser2)
        .enqueueTransferIntoDolomiteMargin(vaultAddress, amountWei);

      const queuedTransfer = await factory.getQueuedTransferByCursor(1);
      expect(queuedTransfer.from).to.eq(core.hhUser2.address);
      expect(queuedTransfer.to).to.eq(core.dolomiteMargin.address);
      expect(queuedTransfer.amount).to.eq(amountWei);
      expect(queuedTransfer.vault).to.eq(vaultAddress);

      await expectEvent(factory, result, 'TransferQueued', {
        transferCursor: 1,
        from: core.hhUser2.address,
        to: core.dolomiteMargin.address,
        amount: amountWei,
        vault: vaultAddress,
      });
    });

    it('should fail when vault is invalid', async () => {
      await factory.connect(core.governance).ownerSetIsTokenConverterTrusted(core.hhUser3.address, true);
      await expectThrow(
        factory.connect(core.hhUser3).enqueueTransferIntoDolomiteMargin(core.hhUser4.address, amountWei),
        `IsolationModeVaultFactory: Invalid vault <${core.hhUser4.address.toLowerCase()}>`,
      );
    });
  });

  describe('#enqueueTransferFromDolomiteMargin', () => {
    async function executeUnwrapV1(
      vaultImplementation: SignerWithAddress,
      inputMarketId: BigNumberish,
      outputMarketId: BigNumberish,
      signer?: SignerWithAddress,
    ): Promise<ContractTransaction> {
      const solidAccountId = 0;
      const actions = await tokenUnwrapperV1.createActionsForUnwrappingForLiquidation(
        solidAccountId,
        solidAccountId,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        outputMarketId,
        inputMarketId,
        ZERO_BI,
        smallAmountWei,
      );
      return core.dolomiteMargin
        .connect(signer ?? vaultImplementation)
        .operate([{ owner: vaultImplementation.address, number: toAccountNumber }], actions);
    }

    async function executeUnwrapV2(
      vault: string,
      inputMarketId: BigNumberish,
      outputMarketId: BigNumberish,
    ): Promise<ContractTransaction> {
      const solidAccountId = 0;
      const actions = await tokenUnwrapperV2.createActionsForUnwrapping({
        primaryAccountId: solidAccountId,
        otherAccountId: solidAccountId,
        primaryAccountOwner: vault,
        primaryAccountNumber: ZERO_BI,
        otherAccountOwner: vault,
        otherAccountNumber: ZERO_BI,
        outputMarket: outputMarketId,
        inputMarket: inputMarketId,
        minOutputAmount: ZERO_BI,
        inputAmount: smallAmountWei,
        orderData: BYTES_EMPTY,
      });
      const genericTrader = await impersonate(core.genericTraderProxy!.address, true);
      return core.dolomiteMargin
        .connect(genericTrader)
        .operate([{ owner: vault, number: toAccountNumber }], actions);
    }

    it('should work when called by a V1 token converter', async () => {
      await factory.connect(core.hhUser1).createVault(core.hhUser1.address);

      const vault = await setupUserVaultProxy<TestIsolationModeTokenVaultV1>(
        await factory.getVaultByAccount(core.hhUser1.address),
        TestIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(toAccountNumber, amountWei);

      const vaultImplementation = await impersonate(vault.address, true);
      await otherToken.addBalance(core.dolomiteMargin.address, amountWei);
      expect(await factory.isTokenConverterTrusted(tokenUnwrapperV1.address)).to.eq(true);
      await core.dolomiteMargin.ownerSetGlobalOperator(vaultImplementation.address, true);
      await expectThrow(
        executeUnwrapV1(vaultImplementation, core.marketIds.weth, otherMarketId),
        `IsolationModeUnwrapperTraderV1: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`,
      );
      const result = await executeUnwrapV1(vaultImplementation, underlyingMarketId, otherMarketId);

      const queuedTransfer = await factory.getQueuedTransferByCursor(2);
      expect(queuedTransfer.from).to.eq(core.dolomiteMargin.address);
      expect(queuedTransfer.to).to.eq(tokenUnwrapperV1.address);
      expect(queuedTransfer.amount).to.eq(smallAmountWei);
      expect(queuedTransfer.vault).to.eq(vault.address);

      await expectEvent(factory, result, 'TransferQueued', {
        transferCursor: 2,
        from: core.dolomiteMargin.address,
        to: tokenUnwrapperV1.address,
        amount: smallAmountWei,
        vault: vault.address,
      });

      const cumulativeBalance = amountWei.sub(smallAmountWei);
      expect(await otherToken.balanceOf(core.dolomiteMargin.address)).to.eq(smallAmountWei.add(amountWei));
      expect(await underlyingToken.balanceOf(tokenUnwrapperV1.address)).to.eq(smallAmountWei);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(cumulativeBalance);
      expect(await factory.balanceOf(core.dolomiteMargin.address)).to.eq(cumulativeBalance);
      await expectProtocolBalance(core, vault.address, toAccountNumber, underlyingMarketId, cumulativeBalance);
    });

    it('should work when called by a V2 token converter', async () => {
      await factory.connect(core.hhUser1).createVault(core.hhUser1.address);

      const vault = await setupUserVaultProxy<TestIsolationModeTokenVaultV1>(
        await factory.getVaultByAccount(core.hhUser1.address),
        TestIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(toAccountNumber, amountWei);

      await otherToken.addBalance(core.dolomiteMargin.address, amountWei);
      expect(await factory.isTokenConverterTrusted(tokenUnwrapperV2.address)).to.eq(true);
      await expectThrow(
        executeUnwrapV2(vault.address, core.marketIds.weth, otherMarketId),
        `IsolationModeUnwrapperTraderV2: Invalid input market <${core.marketIds.weth.toString()}>`,
      );
      const result = await executeUnwrapV2(vault.address, underlyingMarketId, otherMarketId);

      const queuedTransfer = await factory.getQueuedTransferByCursor(2);
      expect(queuedTransfer.from).to.eq(core.dolomiteMargin.address);
      expect(queuedTransfer.to).to.eq(tokenUnwrapperV2.address);
      expect(queuedTransfer.amount).to.eq(smallAmountWei);
      expect(queuedTransfer.vault).to.eq(vault.address);

      await expectEvent(factory, result, 'TransferQueued', {
        transferCursor: 2,
        from: core.dolomiteMargin.address,
        to: tokenUnwrapperV2.address,
        amount: smallAmountWei,
        vault: vault.address,
      });

      const cumulativeBalance = amountWei.sub(smallAmountWei);
      expect(await otherToken.balanceOf(core.dolomiteMargin.address)).to.eq(smallAmountWei.add(amountWei));
      expect(await underlyingToken.balanceOf(tokenUnwrapperV2.address)).to.eq(smallAmountWei);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(cumulativeBalance);
      expect(await factory.balanceOf(core.dolomiteMargin.address)).to.eq(cumulativeBalance);
      await expectProtocolBalance(core, vault.address, toAccountNumber, underlyingMarketId, cumulativeBalance);
    });

    it('should fail when not called by token converter', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).enqueueTransferFromDolomiteMargin(core.hhUser1.address, amountWei),
        `IsolationModeVaultFactory: Caller is not a token converter <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should overwrite cursor if already queued', async () => {
      await factory.connect(core.hhUser1).createVault(core.hhUser1.address);
      const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
      await factory.connect(core.governance).ownerSetIsTokenConverterTrusted(core.hhUser2.address, true);

      await factory.connect(core.hhUser2).enqueueTransferIntoDolomiteMargin(vaultAddress, amountWei);
      expect(await factory.allowance(vaultAddress, core.dolomiteMargin.address)).to.eq(amountWei);
      expect(await factory.transferCursor()).to.eq(1);

      const result = await factory.connect(core.hhUser2)
        .enqueueTransferFromDolomiteMargin(vaultAddress, amountWei);
      expect(await factory.allowance(vaultAddress, core.dolomiteMargin.address)).to.eq(ZERO_BI);

      expect(await factory.transferCursor()).to.eq(2);
      const queuedTransfer = await factory.getQueuedTransferByCursor(2);
      expect(queuedTransfer.from).to.eq(core.dolomiteMargin.address);
      expect(queuedTransfer.to).to.eq(core.hhUser2.address);
      expect(queuedTransfer.amount).to.eq(amountWei);
      expect(queuedTransfer.vault).to.eq(vaultAddress);

      await expectEvent(factory, result, 'TransferQueued', {
        transferCursor: 2,
        from: core.dolomiteMargin.address,
        to: core.hhUser2.address,
        amount: amountWei,
        vault: vaultAddress,
      });
    });

    it('should fail when vault is invalid', async () => {
      await factory.connect(core.governance).ownerSetIsTokenConverterTrusted(core.hhUser3.address, true);
      await expectThrow(
        factory.connect(core.hhUser3).enqueueTransferFromDolomiteMargin(core.hhUser4.address, amountWei),
        `IsolationModeVaultFactory: Invalid vault <${core.hhUser4.address.toLowerCase()}>`,
      );
    });
  });

  describe('#depositIntoDolomiteMargin', () => {
    it('should work normally', async () => {
      await factory.connect(core.hhUser1).createVault(core.hhUser1.address);

      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
      await underlyingToken.connect(core.hhUser1).approve(vaultAddress, amountWei);

      const vault = setupUserVaultProxy<IsolationModeTokenVaultV1>(
        vaultAddress,
        IsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );
      const result = await vault.depositIntoVaultForDolomiteMargin(toAccountNumber, amountWei);
      await expectEvent(factory, result, 'TransferQueued', {
        transferCursor: 1,
        from: vault.address,
        to: core.dolomiteMargin.address,
        amount: amountWei,
        vault: vault.address,
      });

      await expectProtocolBalance(core, core.hhUser1.address, toAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, vaultAddress, toAccountNumber, underlyingMarketId, amountWei);

      await expectWalletBalance(core.hhUser1, underlyingToken, ZERO_BI);
      await expectWalletBalance(vaultAddress, underlyingToken, amountWei);
      await expectWalletBalance(core.dolomiteMargin.address, factory, amountWei);

      await expectWalletAllowance(core.hhUser1, vault, underlyingToken, ZERO_BI);
      await expectWalletAllowance(vault, core.dolomiteMargin.address, factory, ZERO_BI);

      await expectTotalSupply(factory, amountWei);
    });

    it('should fail when not called by vault', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).depositIntoDolomiteMargin(toAccountNumber, amountWei),
        `IsolationModeVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#withdrawFromDolomiteMargin', () => {
    it('should work normally', async () => {
      await factory.connect(core.hhUser1).createVault(core.hhUser1.address);

      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
      await underlyingToken.connect(core.hhUser1).approve(vaultAddress, amountWei);

      const vault = setupUserVaultProxy<IsolationModeTokenVaultV1>(
        vaultAddress,
        IsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );
      await vault.depositIntoVaultForDolomiteMargin(toAccountNumber, amountWei);

      const result = await vault.withdrawFromVaultForDolomiteMargin(toAccountNumber, amountWei);
      await expectEvent(factory, result, 'TransferQueued', {
        transferCursor: 2,
        from: core.dolomiteMargin.address,
        to: vault.address,
        amount: amountWei,
        vault: vault.address,
      });

      await expectProtocolBalance(core, core.hhUser1.address, toAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, vaultAddress, toAccountNumber, underlyingMarketId, ZERO_BI);

      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);
      await expectWalletBalance(vaultAddress, underlyingToken, ZERO_BI);
      await expectWalletBalance(core.dolomiteMargin.address, factory, ZERO_BI);

      await expectWalletAllowance(core.hhUser1, vault, underlyingToken, ZERO_BI);
      await expectWalletAllowance(vault, core.dolomiteMargin.address, factory, ZERO_BI);

      await expectTotalSupply(factory, ZERO_BI);
    });

    it('should fail when balance would go negative', async () => {
      await factory.connect(core.hhUser1).createVault(core.hhUser1.address);

      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
      await underlyingToken.connect(core.hhUser1).approve(vaultAddress, amountWei);

      const vault = setupUserVaultProxy<IsolationModeTokenVaultV1>(
        vaultAddress,
        IsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );
      await vault.depositIntoVaultForDolomiteMargin(toAccountNumber, amountWei);

      await vault.withdrawFromVaultForDolomiteMargin(toAccountNumber, amountWei);

      await expectThrow(
        vault.withdrawFromVaultForDolomiteMargin(toAccountNumber, amountWei),
        'Token: transfer failed',
      );
    });

    it('should fail when not called by vault', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).withdrawFromDolomiteMargin(toAccountNumber, amountWei),
        `IsolationModeVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#_transfer', () => {
    it('should not work when not called by DolomiteMargin', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).transfer(core.hhUser2.address, amountWei),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should not work when transferring from the 0 address', async () => {
      const zeroSigner = await impersonate(ZERO_ADDRESS, true);
      await factory.connect(zeroSigner).setShouldSpendAllowance(false);
      const sender = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        factory.connect(sender).transferFrom(ZERO_ADDRESS, core.hhUser1.address, amountWei),
        'IsolationModeVaultFactory: Transfer from the zero address',
      );
    });

    it('should not work when transferring to the 0 address', async () => {
      const sender = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        factory.connect(sender).transfer(ZERO_ADDRESS, amountWei),
        'IsolationModeVaultFactory: Transfer to the zero address',
      );
    });

    it('should not work when from/to is not DolomiteMargin', async () => {
      const sender = await impersonate(core.dolomiteMargin.address, true);
      await factory.connect(core.hhUser1).approve(sender.address, ethers.constants.MaxUint256);
      await expectThrow(
        factory.connect(sender).transferFrom(core.hhUser1.address, core.hhUser2.address, amountWei),
        'IsolationModeVaultFactory: from/to must eq DolomiteMargin',
      );
    });

    it('should not work when transfer is not queued', async () => {
      const sender = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        factory.connect(sender).transfer(core.hhUser2.address, amountWei),
        'IsolationModeVaultFactory: Invalid queued transfer',
      );
    });

    it('should not work when transfer is already executed', async () => {
      await factory.connect(core.hhUser1).createVault(core.hhUser1.address);
      const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);

      const vault = setupUserVaultProxy<IsolationModeTokenVaultV1>(
        vaultAddress,
        IsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(toAccountNumber, smallAmountWei);

      const vaultImpersonator = await impersonate(vaultAddress, true);
      await factory.connect(vaultImpersonator).approve(core.dolomiteMargin.address, smallAmountWei);

      const sender = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        factory.connect(sender).transferFrom(vaultAddress, core.dolomiteMargin.address, smallAmountWei),
        'IsolationModeVaultFactory: Transfer already executed <1>',
      );
    });

    it('should not work when transfer is queued but FROM is invalid vault', async () => {
      await factory.createVault(core.hhUser1.address);
      const vaultAddress = await factory.calculateVaultByAccount(core.hhUser1.address);
      const spender = await impersonate(core.dolomiteMargin.address, true);
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await factory.connect(core.hhUser1).approve(spender.address, amountWei);

      await factory.testEnqueueTransfer(
        core.hhUser1.address,
        core.dolomiteMargin.address,
        amountWei,
        vaultAddress,
      );
      expect(await factory.transferCursor()).to.eq('0');
      const currentTransfer = await factory.getQueuedTransferByCursor('0');
      expect(currentTransfer.from).to.eq(core.hhUser1.address);
      expect(currentTransfer.to).to.eq(core.dolomiteMargin.address);
      expect(currentTransfer.amount).to.eq(amountWei);
      expect(currentTransfer.vault).to.eq(vaultAddress);
      await expectThrow(
        factory.connect(spender).transferFrom(core.hhUser1.address, core.dolomiteMargin.address, amountWei),
        'IsolationModeVaultFactory: Invalid from',
      );
    });

    it('should not work when transfer is queued but TO is invalid vault', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      const vaultAddress = await factory.calculateVaultByAccount(core.hhUser1.address);
      await underlyingToken.connect(core.hhUser1).approve(vaultAddress, amountWei);
      await factory.connect(core.hhUser1).createVault(core.hhUser1.address);

      await factory.testEnqueueTransfer(
        core.dolomiteMargin.address,
        core.hhUser1.address,
        amountWei,
        vaultAddress,
      );
      expect(await factory.transferCursor()).to.eq('0');
      const currentTransfer = await factory.getQueuedTransferByCursor('0');
      expect(currentTransfer.from).to.eq(core.dolomiteMargin.address);
      expect(currentTransfer.to).to.eq(core.hhUser1.address);
      expect(currentTransfer.amount).to.eq(amountWei);
      expect(currentTransfer.vault).to.eq(vaultAddress);
      const sender = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        factory.connect(sender).transfer(core.hhUser1.address, amountWei),
        'IsolationModeVaultFactory: Invalid to',
      );
    });
  });

  describe('#isIsolationAsset', () => {
    it('should work normally', async () => {
      expect(await factory.isIsolationAsset()).to.eq(true);
    });
  });

  describe('#getProxyVaultInitCodeHash', () => {
    it('should work normally', async () => {
      const bytecode = IsolationModeUpgradeableProxy__factory.bytecode;
      expect(await factory.getProxyVaultInitCodeHash()).to.eq(ethers.utils.keccak256(bytecode));
    });
  });

  describe('#getQueuedTransferByCursor', () => {
    it('should work when transfer cursor is lte current cursor', async () => {
      // the user has not queued any transfers yet. The current cursor is 0.
      const queuedTransfer = await factory.getQueuedTransferByCursor('0');
      expect(queuedTransfer.from).to.eq(ZERO_ADDRESS);
      expect(queuedTransfer.to).to.eq(ZERO_ADDRESS);
      expect(queuedTransfer.amount).to.eq(ZERO_BI);
      expect(queuedTransfer.vault).to.eq(ZERO_ADDRESS);
    });

    it('should fail when transfer cursor is gt current cursor', async () => {
      // the user has not queued any transfers yet. The current cursor is 0.
      await expectThrow(
        factory.getQueuedTransferByCursor('1'),
        'IsolationModeVaultFactory: Invalid transfer cursor',
      );
    });
  });

  describe('#requireIsTokenConverterOrVault', () => {
    it('should work normally if token converter', async () => {
      const wrapperImpersonator = await impersonate(tokenWrapperV1.address, true);
      await expect(factory.connect(wrapperImpersonator).testRequireIsTokenConverterOrVault()).to.not.be.reverted;
    });

    it('should work normally if vault', async () => {
      await factory.createVault(core.hhUser1.address);
      const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
      const vaultImpersonator = await impersonate(vaultAddress, true);
      await expect(factory.connect(vaultImpersonator).testRequireIsTokenConverterOrVault()).to.not.be.reverted;
    });

    it('should fail if not token converter or vault', async () => {
      await expectThrow(
        factory.testRequireIsTokenConverterOrVault(),
        `IsolationModeVaultFactory: Caller is not a authorized <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#name', () => {
    it('should work normally', async () => {
      expect(await factory.name()).to.eq('Dolomite Isolation: Test Token');
    });
  });

  describe('#symbol', () => {
    it('should work normally', async () => {
      expect(await factory.symbol()).to.eq('dTEST');
    });
  });

  describe('#decimals', () => {
    it('should work normally', async () => {
      expect(await factory.decimals()).to.eq(18);
    });
  });
});
