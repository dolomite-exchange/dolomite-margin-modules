import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BaseContract, BigNumber, ContractTransaction, ethers } from 'ethers';
import {
  CustomTestToken,
  GLPUnwrapperProxyV1,
  TestWrappedTokenUserVaultFactory,
  TestWrappedTokenUserVaultFactory__factory,
  TestWrappedTokenUserVaultV1__factory,
  WrappedTokenUserVaultProxy,
  WrappedTokenUserVaultProxy__factory,
  WrappedTokenUserVaultV1,
  WrappedTokenUserVaultV1__factory,
} from '../../../src/types';
import { BORROW_POSITION_PROXY_V2, DOLOMITE_MARGIN, ZERO_BI } from '../../../src/utils/constants';
import { createContractWithAbi, createTestToken } from '../../../src/utils/dolomite-utils';
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
import { createGlpUnwrapperProxy, createWrappedTokenFactory } from './wrapped-token-utils';

const toAccountNumber = '0';
const amountWei = BigNumber.from('2000000000000000000');

describe('WrappedTokenUserVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: CustomTestToken;
  let underlyingMarketId: BigNumber;
  let tokenUnwrapper: GLPUnwrapperProxyV1;
  let wrappedTokenFactory: TestWrappedTokenUserVaultFactory;
  let userVaultImplementation: BaseContract;
  let initializeResult: ContractTransaction;

  let solidAccount: SignerWithAddress;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 53107700,
    });
    underlyingToken = await createTestToken();
    userVaultImplementation = await createContractWithAbi(
      TestWrappedTokenUserVaultV1__factory.abi,
      TestWrappedTokenUserVaultV1__factory.bytecode,
      [],
    );
    wrappedTokenFactory = await createWrappedTokenFactory(underlyingToken, userVaultImplementation);
    await core.testPriceOracle.setPrice(
      wrappedTokenFactory.address,
      '1000000000000000000', // $1.00
    );

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, wrappedTokenFactory, true);

    tokenUnwrapper = await createGlpUnwrapperProxy(wrappedTokenFactory);
    initializeResult = await wrappedTokenFactory.initialize([tokenUnwrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(wrappedTokenFactory.address, true);

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
        BORROW_POSITION_PROXY_V2.address,
        userVaultImplementation.address,
        DOLOMITE_MARGIN.address,
      ],
    );
  }

  async function checkVaultCreationResults(result: ContractTransaction) {
    const vault = await wrappedTokenFactory.getVaultByAccount(core.hhUser1.address);
    const account = await wrappedTokenFactory.getAccountByVault(vault);
    expect(account).to.eq(core.hhUser1.address);
    await expectEvent(wrappedTokenFactory, result, 'VaultCreated', {
      account: core.hhUser1.address,
      vault: vault.toString(),
    });
    await expect(await core.borrowPositionProxyV2.isCallerAuthorized(vault)).to.eq(true);

    const vaultContract = setupUserVaultProxy<WrappedTokenUserVaultProxy>(
      vault,
      WrappedTokenUserVaultProxy__factory,
      core.hhUser1,
    );
    expect(await vaultContract.isInitialized()).to.eq(true);
    expect(await vaultContract.owner()).to.eq(core.hhUser1.address);
  }

  describe('#initialize', () => {
    it('should work when deployed normally', async () => {
      await expectEvent(wrappedTokenFactory, initializeResult, 'Initialized', {});
      await expectEvent(wrappedTokenFactory, initializeResult, 'TokenUnwrapperSet', {
        tokenUnwrapper: tokenUnwrapper.address,
        isTrusted: true,
      });
      expect(await wrappedTokenFactory.marketId()).to.eq(underlyingMarketId);
      expect(await wrappedTokenFactory.isInitialized()).to.eq(true);
      expect(await wrappedTokenFactory.isTokenUnwrapperTrusted(tokenUnwrapper.address)).to.eq(true);
    });

    it('should fail when already initialized', async () => {
      await expectThrow(
        wrappedTokenFactory.initialize([]),
        'WrappedTokenUserVaultFactory: Already initialized',
      );
    });

    it('should fail when market allows borrowing', async () => {
      const badFactory = await createContractWithAbi<TestWrappedTokenUserVaultFactory>(
        TestWrappedTokenUserVaultFactory__factory.abi,
        TestWrappedTokenUserVaultFactory__factory.bytecode,
        [
          underlyingToken.address,
          BORROW_POSITION_PROXY_V2.address,
          userVaultImplementation.address,
          DOLOMITE_MARGIN.address,
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
        badFactory.initialize([]),
        'WrappedTokenUserVaultFactory: Market cannot allow borrowing',
      );
    });
  });

  describe('#createVault', () => {
    it('should work under normal conditions', async () => {
      const result = await wrappedTokenFactory.connect(core.hhUser1).createVault(core.hhUser1.address);
      await checkVaultCreationResults(result);
    });

    it('should work when a different wallet creates vault for other', async () => {
      const result = await wrappedTokenFactory.connect(core.governance).createVault(core.hhUser1.address);
      await checkVaultCreationResults(result);
    });

    it('should fail when vault is already created', async () => {
      const result = await wrappedTokenFactory.createVault(core.hhUser1.address);
      await checkVaultCreationResults(result);

      await expectThrow(
        wrappedTokenFactory.createVault(core.hhUser1.address),
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
      const vaultAddress = await wrappedTokenFactory.calculateVaultByAccount(core.hhUser1.address);
      await underlyingToken.connect(core.hhUser1).approve(vaultAddress, amountWei);

      const result = await wrappedTokenFactory.connect(core.hhUser1).createVaultAndDepositIntoDolomiteMargin(
        toAccountNumber,
        amountWei,
      );
      await checkVaultCreationResults(result);
      await expectProtocolBalance(core, core.hhUser1.address, toAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, vaultAddress, toAccountNumber, underlyingMarketId, amountWei);
      await expectWalletBalance(core.dolomiteMargin.address, wrappedTokenFactory, amountWei);
    });

    it('should fail when vault is already created', async () => {
      const result = await wrappedTokenFactory.createVault(core.hhUser1.address);
      await checkVaultCreationResults(result);

      await expectThrow(
        wrappedTokenFactory.connect(core.hhUser1).createVaultAndDepositIntoDolomiteMargin(toAccountNumber, amountWei),
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
        WrappedTokenUserVaultProxy__factory.abi,
        WrappedTokenUserVaultProxy__factory.bytecode,
        [],
      );
      const result = await wrappedTokenFactory.connect(core.governance)
        .setUserVaultImplementation(newImplementation.address);
      expect(await wrappedTokenFactory.userVaultImplementation()).to.eq(newImplementation.address);
      await expectEvent(wrappedTokenFactory, result, 'UserVaultImplementationSet', {
        previousUserVaultImplementation: userVaultImplementation.address,
        newUserVaultImplementation: newImplementation.address,
      });
    });

    it('should fail when not called by owner', async () => {
      const newImplementation = await createContractWithAbi(
        WrappedTokenUserVaultProxy__factory.abi,
        WrappedTokenUserVaultProxy__factory.bytecode,
        [],
      );
      await expectThrow(
        wrappedTokenFactory.connect(core.hhUser1).setUserVaultImplementation(newImplementation.address),
        'WrappedTokenUserVaultFactory: Caller is not the owner',
      );
    });

    it('should fail when not not initialized', async () => {
      const newImplementation = await createContractWithAbi(
        WrappedTokenUserVaultProxy__factory.abi,
        WrappedTokenUserVaultProxy__factory.bytecode,
        [],
      );
      const uninitializedFactory = await createUninitializedFactory();
      await expectThrow(
        uninitializedFactory.setUserVaultImplementation(newImplementation.address),
        'WrappedTokenUserVaultFactory: Not initialized',
      );
    });
  });

  describe('#setIsTokenUnwrapperTrusted', () => {
    it('should work when called by governance', async () => {
      const newUnwrapper = await createContractWithAbi(
        WrappedTokenUserVaultProxy__factory.abi,
        WrappedTokenUserVaultProxy__factory.bytecode,
        [],
      );
      const result1 = await wrappedTokenFactory.connect(core.governance)
        .setIsTokenUnwrapperTrusted(newUnwrapper.address, true);
      expect(await wrappedTokenFactory.isTokenUnwrapperTrusted(newUnwrapper.address)).to.eq(true);
      await expectEvent(wrappedTokenFactory, result1, 'TokenUnwrapperSet', {
        tokenUnwrapper: newUnwrapper.address,
        isTrusted: true,
      });

      const result2 = await wrappedTokenFactory.connect(core.governance)
        .setIsTokenUnwrapperTrusted(newUnwrapper.address, false);
      expect(await wrappedTokenFactory.isTokenUnwrapperTrusted(newUnwrapper.address)).to.eq(false);
      await expectEvent(wrappedTokenFactory, result2, 'TokenUnwrapperSet', {
        tokenUnwrapper: newUnwrapper.address,
        isTrusted: false,
      });
    });

    it('should fail when not called by owner', async () => {
      const newUnwrapper = await createContractWithAbi(
        WrappedTokenUserVaultProxy__factory.abi,
        WrappedTokenUserVaultProxy__factory.bytecode,
        [],
      );
      await expectThrow(
        wrappedTokenFactory.connect(core.hhUser1).setIsTokenUnwrapperTrusted(newUnwrapper.address, true),
        'WrappedTokenUserVaultFactory: Caller is not the owner',
      );
    });

    it('should fail when not not initialized', async () => {
      const newUnwrapper = await createContractWithAbi(
        WrappedTokenUserVaultProxy__factory.abi,
        WrappedTokenUserVaultProxy__factory.bytecode,
        [],
      );
      const uninitializedFactory = await createUninitializedFactory();
      await expectThrow(
        uninitializedFactory.setIsTokenUnwrapperTrusted(newUnwrapper.address, true),
        'WrappedTokenUserVaultFactory: Not initialized',
      );
    });
  });

  describe('#depositIntoDolomiteMargin', () => {
    it('should work normally', async () => {
      await wrappedTokenFactory.connect(core.hhUser1).createVault(core.hhUser1.address);

      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      const vaultAddress = await wrappedTokenFactory.getVaultByAccount(core.hhUser1.address);
      await underlyingToken.connect(core.hhUser1).approve(vaultAddress, amountWei);

      const vault = setupUserVaultProxy<WrappedTokenUserVaultV1>(
        vaultAddress,
        WrappedTokenUserVaultV1__factory,
        core.hhUser1,
      );
      await vault.depositIntoVaultForDolomiteMargin(toAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1.address, toAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, vaultAddress, toAccountNumber, underlyingMarketId, amountWei);

      await expectWalletBalance(core.hhUser1, underlyingToken, ZERO_BI);
      await expectWalletBalance(vaultAddress, underlyingToken, amountWei);
      await expectWalletBalance(core.dolomiteMargin.address, wrappedTokenFactory, amountWei);

      await expectWalletAllowance(core.hhUser1, vault, underlyingToken, ZERO_BI);
      await expectWalletAllowance(vault, core.dolomiteMargin.address, wrappedTokenFactory, ZERO_BI);

      await expectTotalSupply(wrappedTokenFactory, amountWei);
    });

    it('should fail when not called by vault', async () => {
      await expectThrow(
        wrappedTokenFactory.connect(core.hhUser1).depositIntoDolomiteMargin(toAccountNumber, amountWei),
        `WrappedTokenUserVaultFactory: Caller is not a vault <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when cursor is already queued (developer error)', async () => {
      await wrappedTokenFactory.connect(core.hhUser1).createVault(core.hhUser1.address);
      const vaultAddress = await wrappedTokenFactory.getVaultByAccount(core.hhUser1.address);

      await wrappedTokenFactory.enqueueTransfer(
        vaultAddress,
        core.dolomiteMargin.address,
        amountWei,
        vaultAddress,
      );

      const vault = setupUserVaultProxy<WrappedTokenUserVaultV1>(
        vaultAddress,
        WrappedTokenUserVaultV1__factory,
        core.hhUser1,
      );
      await expectThrow(
        vault.depositIntoVaultForDolomiteMargin(toAccountNumber, amountWei),
        'WrappedTokenUserVaultFactory: Transfer is already queued',
      );
    });
  });

  describe('#withdrawFromDolomiteMargin', () => {
    it('should work normally', async () => {
      await wrappedTokenFactory.connect(core.hhUser1).createVault(core.hhUser1.address);

      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      const vaultAddress = await wrappedTokenFactory.getVaultByAccount(core.hhUser1.address);
      await underlyingToken.connect(core.hhUser1).approve(vaultAddress, amountWei);

      const vault = setupUserVaultProxy<WrappedTokenUserVaultV1>(
        vaultAddress,
        WrappedTokenUserVaultV1__factory,
        core.hhUser1,
      );
      await vault.depositIntoVaultForDolomiteMargin(toAccountNumber, amountWei);

      await vault.withdrawFromVaultForDolomiteMargin(toAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1.address, toAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, vaultAddress, toAccountNumber, underlyingMarketId, ZERO_BI);

      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);
      await expectWalletBalance(vaultAddress, underlyingToken, ZERO_BI);
      await expectWalletBalance(core.dolomiteMargin.address, wrappedTokenFactory, ZERO_BI);

      await expectWalletAllowance(core.hhUser1, vault, underlyingToken, ZERO_BI);
      await expectWalletAllowance(vault, core.dolomiteMargin.address, wrappedTokenFactory, ZERO_BI);

      await expectTotalSupply(wrappedTokenFactory, ZERO_BI);
    });

    it('should fail when balance would go negative', async () => {
      await wrappedTokenFactory.connect(core.hhUser1).createVault(core.hhUser1.address);

      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      const vaultAddress = await wrappedTokenFactory.getVaultByAccount(core.hhUser1.address);
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
        wrappedTokenFactory.connect(core.hhUser1).withdrawFromDolomiteMargin(toAccountNumber, amountWei),
        `WrappedTokenUserVaultFactory: Caller is not a vault <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when cursor is already queued (developer error)', async () => {
      await wrappedTokenFactory.connect(core.hhUser1).createVault(core.hhUser1.address);
      const vaultAddress = await wrappedTokenFactory.getVaultByAccount(core.hhUser1.address);

      await wrappedTokenFactory.enqueueTransfer(
        vaultAddress,
        core.dolomiteMargin.address,
        amountWei,
        vaultAddress,
      );

      const vault = setupUserVaultProxy<WrappedTokenUserVaultV1>(
        vaultAddress,
        WrappedTokenUserVaultV1__factory,
        core.hhUser1,
      );
      await expectThrow(
        vault.withdrawFromVaultForDolomiteMargin(toAccountNumber, amountWei),
        'WrappedTokenUserVaultFactory: Transfer is already queued',
      );
    });
  });

  describe('#liquidateWithinDolomiteMargin', () => {
    it('should work normally', async () => {
      await wrappedTokenFactory.connect(core.hhUser1).createVault(core.hhUser1.address);

      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      const vaultAddress = await wrappedTokenFactory.getVaultByAccount(core.hhUser1.address);
      await underlyingToken.connect(core.hhUser1).approve(vaultAddress, amountWei);

      const vault = setupUserVaultProxy<WrappedTokenUserVaultV1>(
        vaultAddress,
        WrappedTokenUserVaultV1__factory,
        core.hhUser1,
      );
      await vault.depositIntoVaultForDolomiteMargin(toAccountNumber, amountWei);

      const vaultSigner = await impersonate(vaultAddress, true);
      await wrappedTokenFactory.connect(vaultSigner).liquidateWithinDolomiteMargin(tokenUnwrapper.address, amountWei);

      const transferCursor = await wrappedTokenFactory.transferCursor();
      const queuedTransfer = await wrappedTokenFactory.getQueuedTransferByCursor(transferCursor);
      expect(queuedTransfer.from).to.equal(core.dolomiteMargin.address);
      expect(queuedTransfer.to).to.equal(tokenUnwrapper.address);
      expect(queuedTransfer.amount).to.equal(amountWei);
      expect(queuedTransfer.vault).to.equal(vaultAddress);
    });

    it('should fail when recipient is not an unwrapper', async () => {
      await wrappedTokenFactory.connect(core.hhUser1).createVault(core.hhUser1.address);

      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      const vaultAddress = await wrappedTokenFactory.getVaultByAccount(core.hhUser1.address);
      await underlyingToken.connect(core.hhUser1).approve(vaultAddress, amountWei);

      const vault = setupUserVaultProxy<WrappedTokenUserVaultV1>(
        vaultAddress,
        WrappedTokenUserVaultV1__factory,
        core.hhUser1,
      );
      await vault.depositIntoVaultForDolomiteMargin(toAccountNumber, amountWei);

      const vaultSigner = await impersonate(vaultAddress, true);
      await expectThrow(
        wrappedTokenFactory.connect(vaultSigner).liquidateWithinDolomiteMargin(solidAccount.address, amountWei),
        'WrappedTokenUserVaultFactory: Invalid liquidation recipient',
      );
    });

    it('should fail when not called by vault', async () => {
      await expectThrow(
        wrappedTokenFactory.connect(core.hhUser1).liquidateWithinDolomiteMargin(solidAccount.address, amountWei),
        `WrappedTokenUserVaultFactory: Caller is not a vault <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when cursor is already queued (developer error)', async () => {
      await wrappedTokenFactory.connect(core.hhUser1).createVault(core.hhUser1.address);
      const vaultAddress = await wrappedTokenFactory.getVaultByAccount(core.hhUser1.address);

      await wrappedTokenFactory.enqueueTransfer(
        vaultAddress,
        core.dolomiteMargin.address,
        amountWei,
        vaultAddress,
      );

      const vault = await impersonate(vaultAddress, true);
      await expectThrow(
        wrappedTokenFactory.connect(vault).liquidateWithinDolomiteMargin(solidAccount.address, amountWei),
        'WrappedTokenUserVaultFactory: Transfer is already queued',
      );
    });
  });

  describe('#_transfer', () => {
    it('should not work when not called by DolomiteMargin', async () => {
      await expectThrow(
        wrappedTokenFactory.connect(core.hhUser1).transfer(core.hhUser2.address, amountWei),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should not work when transferring from the 0 address', async () => {
      // This can't actually be tested because the default implementation for ERC20 reverts when the owner is the zero
      // address

      // const sender = await impersonate(core.dolomiteMargin.address, true);
      // const zeroSender = await impersonate(ZERO_ADDRESS, true);
      // await wrappedTokenFactory.connect(zeroSender).approve(sender.address, ethers.constants.MaxUint256);
      // await expectThrow(
      //   wrappedTokenFactory.connect(sender).transferFrom(ZERO_ADDRESS, core.hhUser2.address, amountWei),
      //   'WrappedTokenUserVaultFactory: Transfer from the zero address',
      // );
    });

    it('should not work when transferring to the 0 address', async () => {
      const sender = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrappedTokenFactory.connect(sender).transfer(ZERO_ADDRESS, amountWei),
        'WrappedTokenUserVaultFactory: Transfer to the zero address',
      );
    });

    it('should not work when from/to is not DolomiteMargin', async () => {
      const sender = await impersonate(core.dolomiteMargin.address, true);
      await wrappedTokenFactory.connect(core.hhUser1).approve(sender.address, ethers.constants.MaxUint256);
      await expectThrow(
        wrappedTokenFactory.connect(sender).transferFrom(core.hhUser1.address, core.hhUser2.address, amountWei),
        'WrappedTokenUserVaultFactory: from/to must eq DolomiteMargin',
      );
    });

    it('should not work when transfer is not queued', async () => {
      const sender = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrappedTokenFactory.connect(sender).transfer(core.hhUser2.address, amountWei),
        'WrappedTokenUserVaultFactory: Invalid queued transfer',
      );
    });

    it('should not work when transfer is queued but FROM is invalid vault', async () => {
      await wrappedTokenFactory.createVault(core.hhUser1.address);
      const vaultAddress = await wrappedTokenFactory.calculateVaultByAccount(core.hhUser1.address);
      const spender = await impersonate(core.dolomiteMargin.address, true);
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await wrappedTokenFactory.connect(core.hhUser1).approve(spender.address, amountWei);

      await wrappedTokenFactory.enqueueTransfer(
        core.hhUser1.address,
        core.dolomiteMargin.address,
        amountWei,
        vaultAddress,
      );
      expect(await wrappedTokenFactory.transferCursor()).to.eq('0');
      const currentTransfer = await wrappedTokenFactory.getQueuedTransferByCursor('0');
      expect(currentTransfer.from).to.eq(core.hhUser1.address);
      expect(currentTransfer.to).to.eq(core.dolomiteMargin.address);
      expect(currentTransfer.amount).to.eq(amountWei);
      expect(currentTransfer.vault).to.eq(vaultAddress);
      await expectThrow(
        wrappedTokenFactory.connect(spender).transferFrom(core.hhUser1.address, core.dolomiteMargin.address, amountWei),
        'WrappedTokenUserVaultFactory: Invalid from',
      );
    });

    it('should not work when transfer is queued but TO is invalid vault', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      const vaultAddress = await wrappedTokenFactory.calculateVaultByAccount(core.hhUser1.address);
      await underlyingToken.connect(core.hhUser1).approve(vaultAddress, amountWei);
      await wrappedTokenFactory.connect(core.hhUser1).createVault(core.hhUser1.address);

      await wrappedTokenFactory.enqueueTransfer(
        core.dolomiteMargin.address,
        core.hhUser1.address,
        amountWei,
        vaultAddress,
      );
      expect(await wrappedTokenFactory.transferCursor()).to.eq('0');
      const currentTransfer = await wrappedTokenFactory.getQueuedTransferByCursor('0');
      expect(currentTransfer.from).to.eq(core.dolomiteMargin.address);
      expect(currentTransfer.to).to.eq(core.hhUser1.address);
      expect(currentTransfer.amount).to.eq(amountWei);
      expect(currentTransfer.vault).to.eq(vaultAddress);
      const sender = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrappedTokenFactory.connect(sender).transfer(core.hhUser1.address, amountWei),
        'WrappedTokenUserVaultFactory: Invalid to',
      );
    });
  });

  describe('#isIsolationAsset', () => {
    it('should work normally', async () => {
      expect(await wrappedTokenFactory.isIsolationAsset()).to.eq(true);
    });
  });

  describe('#getQueuedTransferByCursor', () => {
    it('should work when transfer cursor is lte current cursor', async () => {
      // the user has not queued any transfers yet. The current cursor is 0.
      const queuedTransfer = await wrappedTokenFactory.getQueuedTransferByCursor('0');
      expect(queuedTransfer.from).to.eq(ZERO_ADDRESS);
      expect(queuedTransfer.to).to.eq(ZERO_ADDRESS);
      expect(queuedTransfer.amount).to.eq(ZERO_BI);
      expect(queuedTransfer.vault).to.eq(ZERO_ADDRESS);
    });

    it('should fail when transfer cursor is gt current cursor', async () => {
      // the user has not queued any transfers yet. The current cursor is 0.
      await expectThrow(
        wrappedTokenFactory.getQueuedTransferByCursor('1'),
        'WrappedTokenUserVaultFactory: Invalid transfer cursor',
      );
    });
  });

  describe('#name', () => {
    it('should work normally', async () => {
      expect(await wrappedTokenFactory.name()).to.eq('Dolomite: Test Token');
    });
  });

  describe('#symbol', () => {
    it('should work normally', async () => {
      expect(await wrappedTokenFactory.symbol()).to.eq('dTEST');
    });
  });

  describe('#decimals', () => {
    it('should work normally', async () => {
      expect(await wrappedTokenFactory.decimals()).to.eq(18);
    });
  });
});
