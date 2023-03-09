import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BaseContract, BigNumber, BigNumberish, ContractTransaction, ethers } from 'ethers';
import {
  CustomTestToken,
  TestWrappedTokenUserVaultFactory,
  TestWrappedTokenUserVaultFactory__factory,
  TestWrappedTokenUserVaultUnwrapper,
  TestWrappedTokenUserVaultUnwrapper__factory,
  TestWrappedTokenUserVaultV1,
  TestWrappedTokenUserVaultV1__factory,
  TestWrappedTokenUserVaultWrapper,
  TestWrappedTokenUserVaultWrapper__factory,
  WrappedTokenUserVaultUpgradeableProxy,
  WrappedTokenUserVaultUpgradeableProxy__factory,
  WrappedTokenUserVaultV1,
  WrappedTokenUserVaultV1__factory,
} from '../../../src/types';
import { createContractWithAbi, createTestToken } from '../../../src/utils/dolomite-utils';
import { BYTES_EMPTY, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectThrow,
  expectTotalSupply,
  expectWalletAllowance,
  expectWalletBalance,
} from '../../utils/assertions';
import { CoreProtocol, setupCoreProtocol, setupTestMarket, setupUserVaultProxy } from '../../utils/setup';
import { createTestWrappedTokenFactory } from '../../utils/wrapped-token-utils';

const toAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // 200 units
const smallAmountWei = BigNumber.from('10000000000000000000'); // 10 units

describe('WrappedTokenUserVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: CustomTestToken;
  let underlyingMarketId: BigNumber;
  let otherToken: CustomTestToken;
  let otherMarketId: BigNumber;
  let rewardToken: CustomTestToken;
  let rewardMarketId: BigNumber;
  let tokenUnwrapper: TestWrappedTokenUserVaultUnwrapper;
  let tokenWrapper: TestWrappedTokenUserVaultWrapper;
  let factory: TestWrappedTokenUserVaultFactory;
  let userVaultImplementation: BaseContract;
  let initializeResult: ContractTransaction;

  let solidAccount: SignerWithAddress;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 53107700,
    });
    underlyingToken = await createTestToken();
    otherToken = await createTestToken();
    userVaultImplementation = await createContractWithAbi(
      TestWrappedTokenUserVaultV1__factory.abi,
      TestWrappedTokenUserVaultV1__factory.bytecode,
      [],
    );
    factory = await createTestWrappedTokenFactory(core, underlyingToken, userVaultImplementation);
    await core.testPriceOracle.setPrice(
      factory.address,
      '1000000000000000000', // $1.00
    );
    await core.testPriceOracle.setPrice(
      otherToken.address,
      '1000000000000000000', // $1.00
    );

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);

    otherMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken, false);

    rewardToken = await createTestToken();
    await core.testPriceOracle.setPrice(
      rewardToken.address,
      '1000000000000000000', // $1.00
    );
    rewardMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, rewardToken, false);

    tokenUnwrapper = await createContractWithAbi<TestWrappedTokenUserVaultUnwrapper>(
      TestWrappedTokenUserVaultUnwrapper__factory.abi,
      TestWrappedTokenUserVaultUnwrapper__factory.bytecode,
      [
        otherToken.address,
        factory.address,
        core.dolomiteMargin.address,
      ],
    );
    tokenWrapper = await createContractWithAbi<TestWrappedTokenUserVaultWrapper>(
      TestWrappedTokenUserVaultWrapper__factory.abi,
      TestWrappedTokenUserVaultWrapper__factory.bytecode,
      [factory.address, core.dolomiteMargin.address],
    );
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(tokenWrapper.address, true);
    initializeResult = await factory.connect(core.governance)
      .initialize([tokenUnwrapper.address, tokenWrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    solidAccount = core.hhUser5;

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  async function createUninitializedFactory() {
    return createContractWithAbi<TestWrappedTokenUserVaultFactory>(
      TestWrappedTokenUserVaultFactory__factory.abi,
      TestWrappedTokenUserVaultFactory__factory.bytecode,
      [
        underlyingToken.address,
        core.borrowPositionProxyV2.address,
        userVaultImplementation.address,
        core.dolomiteMargin.address,
      ],
    );
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

    const vaultContract = setupUserVaultProxy<WrappedTokenUserVaultUpgradeableProxy>(
      vault,
      WrappedTokenUserVaultUpgradeableProxy__factory,
      core.hhUser1,
    );
    expect(await vaultContract.isInitialized()).to.eq(true);
    expect(await vaultContract.owner()).to.eq(core.hhUser1.address);
  }

  describe('#initialize', () => {
    it('should work when deployed normally', async () => {
      await expectEvent(factory, initializeResult, 'Initialized', {});
      await expectEvent(factory, initializeResult, 'TokenConverterSet', {
        tokenConverter: tokenUnwrapper.address,
        isTrusted: true,
      });
      expect(await factory.marketId()).to.eq(underlyingMarketId);
      expect(await factory.isInitialized()).to.eq(true);
      expect(await factory.isTokenConverterTrusted(tokenUnwrapper.address)).to.eq(true);
    });

    it('should fail when already initialized', async () => {
      await expectThrow(
        factory.connect(core.governance).initialize([]),
        'WrappedTokenUserVaultFactory: Already initialized',
      );
    });

    it('should fail when not called by DolomiteMargin owner', async () => {
      const badFactory = await createContractWithAbi<TestWrappedTokenUserVaultFactory>(
        TestWrappedTokenUserVaultFactory__factory.abi,
        TestWrappedTokenUserVaultFactory__factory.bytecode,
        [
          underlyingToken.address,
          core.borrowPositionProxyV2.address,
          userVaultImplementation.address,
          core.dolomiteMargin.address,
        ],
      );
      await core.testPriceOracle.setPrice(
        badFactory.address,
        '1000000000000000000', // $1.00
      );
      await core.dolomiteMargin.connect(core.governance).ownerAddMarket(
        badFactory.address,
        core.testPriceOracle.address,
        core.testInterestSetter.address,
        { value: 0 },
        { value: 0 },
        0,
        false,
        false,
      );

      await expectThrow(
        badFactory.connect(core.hhUser1).initialize([]),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when market allows borrowing', async () => {
      const badFactory = await createContractWithAbi<TestWrappedTokenUserVaultFactory>(
        TestWrappedTokenUserVaultFactory__factory.abi,
        TestWrappedTokenUserVaultFactory__factory.bytecode,
        [
          underlyingToken.address,
          core.borrowPositionProxyV2.address,
          userVaultImplementation.address,
          core.dolomiteMargin.address,
        ],
      );
      await core.testPriceOracle.setPrice(
        badFactory.address,
        '1000000000000000000', // $1.00
      );
      await core.dolomiteMargin.connect(core.governance).ownerAddMarket(
        badFactory.address,
        core.testPriceOracle.address,
        core.testInterestSetter.address,
        { value: 0 },
        { value: 0 },
        0,
        false,
        false,
      );

      await expectThrow(
        badFactory.connect(core.governance).initialize([]),
        'WrappedTokenUserVaultFactory: Market cannot allow borrowing',
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

    it('should fail when vault is already created', async () => {
      const result = await factory.createVault(core.hhUser1.address);
      await checkVaultCreationResults(result);

      await expectThrow(
        factory.createVault(core.hhUser1.address),
        'WrappedTokenUserVaultFactory: Vault already exists',
      );
    });

    it('should fail when factory is not initialized', async () => {
      const uninitializedFactory = await createUninitializedFactory();
      await expectThrow(
        uninitializedFactory.createVault(core.hhUser1.address),
        'WrappedTokenUserVaultFactory: Not initialized',
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
        'WrappedTokenUserVaultFactory: Vault already exists',
      );
    });

    it('should fail when factory is not initialized', async () => {
      const uninitializedFactory = await createUninitializedFactory();
      await expectThrow(
        uninitializedFactory.connect(core.hhUser1).createVaultAndDepositIntoDolomiteMargin(toAccountNumber, amountWei),
        'WrappedTokenUserVaultFactory: Not initialized',
      );
    });
  });

  describe('#setUserVaultImplementation', () => {
    it('should work when called by governance', async () => {
      const newImplementation = await createContractWithAbi(
        WrappedTokenUserVaultUpgradeableProxy__factory.abi,
        WrappedTokenUserVaultUpgradeableProxy__factory.bytecode,
        [],
      );
      const result = await factory.connect(core.governance)
        .setUserVaultImplementation(newImplementation.address);
      expect(await factory.userVaultImplementation()).to.eq(newImplementation.address);
      await expectEvent(factory, result, 'UserVaultImplementationSet', {
        previousUserVaultImplementation: userVaultImplementation.address,
        newUserVaultImplementation: newImplementation.address,
      });
    });

    it('should fail when not called by owner', async () => {
      const newImplementation = await createContractWithAbi(
        WrappedTokenUserVaultUpgradeableProxy__factory.abi,
        WrappedTokenUserVaultUpgradeableProxy__factory.bytecode,
        [],
      );
      await expectThrow(
        factory.connect(core.hhUser1).setUserVaultImplementation(newImplementation.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when not not initialized', async () => {
      const newImplementation = await createContractWithAbi(
        WrappedTokenUserVaultUpgradeableProxy__factory.abi,
        WrappedTokenUserVaultUpgradeableProxy__factory.bytecode,
        [],
      );
      const uninitializedFactory = await createUninitializedFactory();
      await expectThrow(
        uninitializedFactory.setUserVaultImplementation(newImplementation.address),
        'WrappedTokenUserVaultFactory: Not initialized',
      );
    });
  });

  describe('#setIsTokenConverterTrusted', () => {
    it('should work when called by governance', async () => {
      const newConverter = await createContractWithAbi(
        WrappedTokenUserVaultUpgradeableProxy__factory.abi,
        WrappedTokenUserVaultUpgradeableProxy__factory.bytecode,
        [],
      );
      const result1 = await factory.connect(core.governance)
        .setIsTokenConverterTrusted(newConverter.address, true);
      expect(await factory.isTokenConverterTrusted(newConverter.address)).to.eq(true);
      await expectEvent(factory, result1, 'TokenConverterSet', {
        tokenConverter: newConverter.address,
        isTrusted: true,
      });

      const result2 = await factory.connect(core.governance)
        .setIsTokenConverterTrusted(newConverter.address, false);
      expect(await factory.isTokenConverterTrusted(newConverter.address)).to.eq(false);
      await expectEvent(factory, result2, 'TokenConverterSet', {
        tokenConverter: newConverter.address,
        isTrusted: false,
      });
    });

    it('should fail when not called by owner', async () => {
      const newConverter = await createContractWithAbi(
        WrappedTokenUserVaultUpgradeableProxy__factory.abi,
        WrappedTokenUserVaultUpgradeableProxy__factory.bytecode,
        [],
      );
      await expectThrow(
        factory.connect(core.hhUser1).setIsTokenConverterTrusted(newConverter.address, true),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when not not initialized', async () => {
      const newConverter = await createContractWithAbi(
        WrappedTokenUserVaultUpgradeableProxy__factory.abi,
        WrappedTokenUserVaultUpgradeableProxy__factory.bytecode,
        [],
      );
      const uninitializedFactory = await createUninitializedFactory();
      await expectThrow(
        uninitializedFactory.setIsTokenConverterTrusted(newConverter.address, true),
        'WrappedTokenUserVaultFactory: Not initialized',
      );
    });
  });

  describe('#depositOtherTokenIntoDolomiteMarginForVaultOwner', () => {
    it('should work normally', async () => {
      await factory.connect(core.hhUser1).createVault(core.hhUser1.address);

      const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);

      const vault = setupUserVaultProxy<TestWrappedTokenUserVaultV1>(
        vaultAddress,
        TestWrappedTokenUserVaultV1__factory,
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
        `WrappedTokenUserVaultFactory: Invalid market <${underlyingMarketId.toString()}>`,
      );
    });

    it('should fail when not called by vault', async () => {
      await expectThrow(
        factory.connect(core.hhUser1)
          .depositOtherTokenIntoDolomiteMarginForVaultOwner(toAccountNumber, core.marketIds.weth, amountWei),
        `WrappedTokenUserVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#enqueueTransferIntoDolomiteMargin', () => {
    async function executeWrap(
      vaultImplementation: SignerWithAddress,
      inputMarketId: BigNumberish,
      outputMarketId: BigNumberish,
      signer?: SignerWithAddress,
    ): Promise<ContractTransaction> {
      const solidAccountId = 0;
      const actions = await tokenWrapper.createActionsForWrapping(
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

    it('should work when called by a token converter', async () => {
      await factory.connect(core.hhUser1).createVault(core.hhUser1.address);

      const vault = await setupUserVaultProxy<TestWrappedTokenUserVaultV1>(
        await factory.getVaultByAccount(core.hhUser1.address),
        TestWrappedTokenUserVaultV1__factory,
        core.hhUser1,
      );
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(toAccountNumber, amountWei);

      const vaultImplementation = await impersonate(vault.address, true);
      await otherToken.addBalance(core.dolomiteMargin.address, amountWei);
      expect(await factory.isTokenConverterTrusted(tokenWrapper.address)).to.eq(true);
      await expectThrow(
        executeWrap(vaultImplementation, otherMarketId, core.marketIds.weth),
        `WrappedTokenUserVaultWrapper: Invalid owed market <${core.marketIds.weth.toString()}>`,
      );
      await expectThrow(
        tokenWrapper.connect(core.hhUser1)
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
      const result = await executeWrap(vaultImplementation, otherMarketId, underlyingMarketId);

      const queuedTransfer = await factory.getQueuedTransferByCursor(2);
      expect(queuedTransfer.from).to.eq(tokenWrapper.address);
      expect(queuedTransfer.to).to.eq(core.dolomiteMargin.address);
      expect(queuedTransfer.amount).to.eq(smallAmountWei);
      expect(queuedTransfer.vault).to.eq(vault.address);

      await expectEvent(factory, result, 'TransferQueued', {
        transferCursor: 2,
        from: tokenWrapper.address,
        to: core.dolomiteMargin.address,
        amount: smallAmountWei,
        vault: vault.address,
      });

      const cumulativeBalance = amountWei.add(smallAmountWei);
      expect(await otherToken.balanceOf(tokenWrapper.address)).to.eq(smallAmountWei);
      expect(await underlyingToken.balanceOf(tokenWrapper.address)).to.eq(ZERO_BI);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(cumulativeBalance);
      expect(await factory.balanceOf(core.dolomiteMargin.address)).to.eq(cumulativeBalance);
      await expectProtocolBalance(core, vault.address, toAccountNumber, underlyingMarketId, cumulativeBalance);
    });

    it('should fail when not called by token converter', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).enqueueTransferIntoDolomiteMargin(core.hhUser1.address, amountWei),
        `WrappedTokenUserVaultFactory: Caller is not a token converter <${core.hhUser1.address.toLowerCase()}>`,
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

      await factory.connect(core.governance).setIsTokenConverterTrusted(core.hhUser2.address, true);
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
      await factory.connect(core.governance).setIsTokenConverterTrusted(core.hhUser3.address, true);
      await expectThrow(
        factory.connect(core.hhUser3).enqueueTransferIntoDolomiteMargin(core.hhUser4.address, amountWei),
        `WrappedTokenUserVaultFactory: Invalid vault <${core.hhUser4.address.toLowerCase()}>`,
      );
    });
  });

  describe('#enqueueTransferFromDolomiteMargin', () => {
    async function executeUnwrap(
      vaultImplementation: SignerWithAddress,
      inputMarketId: BigNumberish,
      outputMarketId: BigNumberish,
      signer?: SignerWithAddress,
    ): Promise<ContractTransaction> {
      const solidAccountId = 0;
      const actions = await tokenUnwrapper.createActionsForUnwrappingForLiquidation(
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

    it('should work when called by a token converter', async () => {
      await factory.connect(core.hhUser1).createVault(core.hhUser1.address);

      const vault = await setupUserVaultProxy<TestWrappedTokenUserVaultV1>(
        await factory.getVaultByAccount(core.hhUser1.address),
        TestWrappedTokenUserVaultV1__factory,
        core.hhUser1,
      );
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(toAccountNumber, amountWei);

      const vaultImplementation = await impersonate(vault.address, true);
      await otherToken.addBalance(core.dolomiteMargin.address, amountWei);
      expect(await factory.isTokenConverterTrusted(tokenUnwrapper.address)).to.eq(true);
      await core.dolomiteMargin.ownerSetGlobalOperator(vaultImplementation.address, true);
      await expectThrow(
        executeUnwrap(vaultImplementation, core.marketIds.weth, otherMarketId),
        `WrappedTokenUserVaultUnwrapper: Invalid taker token <${core.weth.address.toLowerCase()}>`,
      );
      const result = await executeUnwrap(vaultImplementation, underlyingMarketId, otherMarketId);

      const queuedTransfer = await factory.getQueuedTransferByCursor(2);
      expect(queuedTransfer.from).to.eq(core.dolomiteMargin.address);
      expect(queuedTransfer.to).to.eq(tokenUnwrapper.address);
      expect(queuedTransfer.amount).to.eq(smallAmountWei);
      expect(queuedTransfer.vault).to.eq(vault.address);

      await expectEvent(factory, result, 'TransferQueued', {
        transferCursor: 2,
        from: core.dolomiteMargin.address,
        to: tokenUnwrapper.address,
        amount: smallAmountWei,
        vault: vault.address,
      });

      const cumulativeBalance = amountWei.sub(smallAmountWei);
      expect(await otherToken.balanceOf(core.dolomiteMargin.address)).to.eq(smallAmountWei.add(amountWei));
      expect(await underlyingToken.balanceOf(tokenUnwrapper.address)).to.eq(smallAmountWei);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(cumulativeBalance);
      expect(await factory.balanceOf(core.dolomiteMargin.address)).to.eq(cumulativeBalance);
      await expectProtocolBalance(core, vault.address, toAccountNumber, underlyingMarketId, cumulativeBalance);
    });

    it('should fail when not called by token converter', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).enqueueTransferFromDolomiteMargin(core.hhUser1.address, amountWei),
        `WrappedTokenUserVaultFactory: Caller is not a token converter <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should overwrite cursor if already queued', async () => {
      await factory.connect(core.hhUser1).createVault(core.hhUser1.address);
      const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
      await factory.connect(core.governance).setIsTokenConverterTrusted(core.hhUser2.address, true);

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
      await factory.connect(core.governance).setIsTokenConverterTrusted(core.hhUser3.address, true);
      await expectThrow(
        factory.connect(core.hhUser3).enqueueTransferFromDolomiteMargin(core.hhUser4.address, amountWei),
        `WrappedTokenUserVaultFactory: Invalid vault <${core.hhUser4.address.toLowerCase()}>`,
      );
    });
  });

  describe('#depositIntoDolomiteMargin', () => {
    it('should work normally', async () => {
      await factory.connect(core.hhUser1).createVault(core.hhUser1.address);

      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
      await underlyingToken.connect(core.hhUser1).approve(vaultAddress, amountWei);

      const vault = setupUserVaultProxy<WrappedTokenUserVaultV1>(
        vaultAddress,
        WrappedTokenUserVaultV1__factory,
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
        `WrappedTokenUserVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#withdrawFromDolomiteMargin', () => {
    it('should work normally', async () => {
      await factory.connect(core.hhUser1).createVault(core.hhUser1.address);

      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
      await underlyingToken.connect(core.hhUser1).approve(vaultAddress, amountWei);

      const vault = setupUserVaultProxy<WrappedTokenUserVaultV1>(
        vaultAddress,
        WrappedTokenUserVaultV1__factory,
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

      const vault = setupUserVaultProxy<WrappedTokenUserVaultV1>(
        vaultAddress,
        WrappedTokenUserVaultV1__factory,
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
        `WrappedTokenUserVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`,
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

    it('should not work when transferring to the 0 address', async () => {
      const sender = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        factory.connect(sender).transfer(ZERO_ADDRESS, amountWei),
        'WrappedTokenUserVaultFactory: Transfer to the zero address',
      );
    });

    it('should not work when from/to is not DolomiteMargin', async () => {
      const sender = await impersonate(core.dolomiteMargin.address, true);
      await factory.connect(core.hhUser1).approve(sender.address, ethers.constants.MaxUint256);
      await expectThrow(
        factory.connect(sender).transferFrom(core.hhUser1.address, core.hhUser2.address, amountWei),
        'WrappedTokenUserVaultFactory: from/to must eq DolomiteMargin',
      );
    });

    it('should not work when transfer is not queued', async () => {
      const sender = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        factory.connect(sender).transfer(core.hhUser2.address, amountWei),
        'WrappedTokenUserVaultFactory: Invalid queued transfer',
      );
    });

    it('should not work when transfer is already executed', async () => {
      await factory.connect(core.hhUser1).createVault(core.hhUser1.address);
      const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);

      const vault = setupUserVaultProxy<WrappedTokenUserVaultV1>(
        vaultAddress,
        WrappedTokenUserVaultV1__factory,
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
        'WrappedTokenUserVaultFactory: Transfer already executed <1>',
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
        'WrappedTokenUserVaultFactory: Invalid from',
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
        'WrappedTokenUserVaultFactory: Invalid to',
      );
    });
  });

  describe('#isIsolationAsset', () => {
    it('should work normally', async () => {
      expect(await factory.isIsolationAsset()).to.eq(true);
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
        'WrappedTokenUserVaultFactory: Invalid transfer cursor',
      );
    });
  });

  describe('#name', () => {
    it('should work normally', async () => {
      expect(await factory.name()).to.eq('Dolomite: Test Token');
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
