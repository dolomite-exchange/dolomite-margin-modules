import { ActionType, AmountDenomination, AmountReference } from '@dolomite-margin/dist/src';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BaseContract, BigNumber, BigNumberish, ContractTransaction, ethers } from 'ethers';
import {
  CustomTestToken,
  GLPUnwrapperProxyV1,
  TestWrappedTokenUserVaultFactory,
  TestWrappedTokenUserVaultFactory__factory,
  TestWrappedTokenUserVaultFactoryWrapper,
  TestWrappedTokenUserVaultFactoryWrapper__factory,
  TestWrappedTokenUserVaultV1,
  TestWrappedTokenUserVaultV1__factory,
  WrappedTokenUserVaultProxy,
  WrappedTokenUserVaultProxy__factory,
  WrappedTokenUserVaultV1,
  WrappedTokenUserVaultV1__factory,
} from '../../../src/types';
import { BORROW_POSITION_PROXY_V2, DOLOMITE_MARGIN, WETH_MARKET_ID } from '../../../src/utils/constants';
import { createContractWithAbi, createTestToken } from '../../../src/utils/dolomite-utils';
import { ZERO_BI } from '../../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectThrow,
  expectTotalSupply,
  expectWalletAllowance,
  expectWalletBalance,
} from '../../utils/assertions';
import {
  CoreProtocol,
  setupCoreProtocol,
  setupGmxRegistry,
  setupTestMarket,
  setupUserVaultProxy,
} from '../../utils/setup';
import { createGlpUnwrapperProxy, createWrappedTokenFactory } from './wrapped-token-utils';

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
  let tokenUnwrapper: GLPUnwrapperProxyV1;
  let tokenWrapper: TestWrappedTokenUserVaultFactoryWrapper;
  let wrappedTokenFactory: TestWrappedTokenUserVaultFactory;
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
    wrappedTokenFactory = await createWrappedTokenFactory(underlyingToken, userVaultImplementation);
    await core.testPriceOracle.setPrice(
      wrappedTokenFactory.address,
      '1000000000000000000', // $1.00
    );
    await core.testPriceOracle.setPrice(
      otherToken.address,
      '1000000000000000000', // $1.00
    );

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, wrappedTokenFactory, true);

    otherMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken, false);

    rewardToken = await createTestToken();
    await core.testPriceOracle.setPrice(
      rewardToken.address,
      '1000000000000000000', // $1.00
    );
    rewardMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, rewardToken, false);

    const registry = await setupGmxRegistry(core);
    tokenUnwrapper = await createGlpUnwrapperProxy(wrappedTokenFactory, registry);
    tokenWrapper = await createContractWithAbi<TestWrappedTokenUserVaultFactoryWrapper>(
      TestWrappedTokenUserVaultFactoryWrapper__factory.abi,
      TestWrappedTokenUserVaultFactoryWrapper__factory.bytecode,
      [wrappedTokenFactory.address, core.dolomiteMargin.address],
    );
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(tokenWrapper.address, true);
    initializeResult = await wrappedTokenFactory.initialize([tokenUnwrapper.address, tokenWrapper.address]);
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
      await expectEvent(wrappedTokenFactory, initializeResult, 'TokenConverterSet', {
        tokenConverter: tokenUnwrapper.address,
        isTrusted: true,
      });
      expect(await wrappedTokenFactory.marketId()).to.eq(underlyingMarketId);
      expect(await wrappedTokenFactory.isInitialized()).to.eq(true);
      expect(await wrappedTokenFactory.isTokenConverterTrusted(tokenUnwrapper.address)).to.eq(true);
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
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
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

  describe('#setIsTokenConverterTrusted', () => {
    it('should work when called by governance', async () => {
      const newConverter = await createContractWithAbi(
        WrappedTokenUserVaultProxy__factory.abi,
        WrappedTokenUserVaultProxy__factory.bytecode,
        [],
      );
      const result1 = await wrappedTokenFactory.connect(core.governance)
        .setIsTokenConverterTrusted(newConverter.address, true);
      expect(await wrappedTokenFactory.isTokenConverterTrusted(newConverter.address)).to.eq(true);
      await expectEvent(wrappedTokenFactory, result1, 'TokenConverterSet', {
        tokenConverter: newConverter.address,
        isTrusted: true,
      });

      const result2 = await wrappedTokenFactory.connect(core.governance)
        .setIsTokenConverterTrusted(newConverter.address, false);
      expect(await wrappedTokenFactory.isTokenConverterTrusted(newConverter.address)).to.eq(false);
      await expectEvent(wrappedTokenFactory, result2, 'TokenConverterSet', {
        tokenConverter: newConverter.address,
        isTrusted: false,
      });
    });

    it('should fail when not called by owner', async () => {
      const newConverter = await createContractWithAbi(
        WrappedTokenUserVaultProxy__factory.abi,
        WrappedTokenUserVaultProxy__factory.bytecode,
        [],
      );
      await expectThrow(
        wrappedTokenFactory.connect(core.hhUser1).setIsTokenConverterTrusted(newConverter.address, true),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when not not initialized', async () => {
      const newConverter = await createContractWithAbi(
        WrappedTokenUserVaultProxy__factory.abi,
        WrappedTokenUserVaultProxy__factory.bytecode,
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
      await wrappedTokenFactory.connect(core.hhUser1).createVault(core.hhUser1.address);

      const vaultAddress = await wrappedTokenFactory.getVaultByAccount(core.hhUser1.address);

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
      await wrappedTokenFactory.connect(core.hhUser1).createVault(core.hhUser1.address);
      const vaultAddress = await wrappedTokenFactory.getVaultByAccount(core.hhUser1.address);
      const vault = await impersonate(vaultAddress, true);

      await expectThrow(
        wrappedTokenFactory.connect(vault)
          .depositOtherTokenIntoDolomiteMarginForVaultOwner(toAccountNumber, underlyingMarketId, amountWei),
        `WrappedTokenUserVaultFactory: Invalid market <${underlyingMarketId.toString()}>`,
      );
    });

    it('should fail when not called by vault', async () => {
      await expectThrow(
        wrappedTokenFactory.connect(core.hhUser1)
          .depositOtherTokenIntoDolomiteMarginForVaultOwner(toAccountNumber, WETH_MARKET_ID, amountWei),
        `WrappedTokenUserVaultFactory: Caller is not a vault <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#enqueueTransferIntoDolomiteMargin', () => {
    function executeWrap(
      vaultImplementation: SignerWithAddress,
      inputMarketId: BigNumberish,
      outputMarketId: BigNumberish,
    ): Promise<ContractTransaction> {
      return DOLOMITE_MARGIN
        .connect(vaultImplementation)
        .operate(
          [{ owner: vaultImplementation.address, number: toAccountNumber }],
        [
          {
            actionType: ActionType.Sell,
            accountId: '0', // accounts[0]
            amount: {
              sign: false,
              denomination: AmountDenomination.Wei,
              ref: AmountReference.Delta,
              value: smallAmountWei,
            },
            primaryMarketId: inputMarketId,
            secondaryMarketId: outputMarketId,
            otherAddress: tokenWrapper.address,
            otherAccountId: 0,
            data: ethers.utils.defaultAbiCoder.encode(['address'], [vaultImplementation.address]),
          },
        ]);
    }

    it('should work when called by a token converter', async () => {
      await wrappedTokenFactory.connect(core.hhUser1).createVault(core.hhUser1.address);

      const vault = await setupUserVaultProxy<TestWrappedTokenUserVaultV1>(
        await wrappedTokenFactory.getVaultByAccount(core.hhUser1.address),
        TestWrappedTokenUserVaultV1__factory,
        core.hhUser1,
      );
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(toAccountNumber, amountWei);

      const vaultImplementation = await impersonate(vault.address, true);
      await otherToken.addBalance(core.dolomiteMargin.address, amountWei);
      expect(await wrappedTokenFactory.isTokenConverterTrusted(tokenWrapper.address)).to.eq(true);
      await expectThrow(
        executeWrap(vaultImplementation, otherMarketId, WETH_MARKET_ID),
        `WrappedTokenUserVaultWrapper: Invalid maker token <${core.weth.address.toLowerCase()}>`,
      );
      const result = await executeWrap(vaultImplementation, otherMarketId, underlyingMarketId);

      const queuedTransfer = await wrappedTokenFactory.getQueuedTransferByCursor(1);
      expect(queuedTransfer.from).to.eq(tokenWrapper.address);
      expect(queuedTransfer.to).to.eq(core.dolomiteMargin.address);
      expect(queuedTransfer.amount).to.eq(smallAmountWei);
      expect(queuedTransfer.vault).to.eq(vault.address);

      await expectEvent(wrappedTokenFactory, result, 'TransferQueued', {
        transferCursor: 1,
        from: tokenWrapper.address,
        to: core.dolomiteMargin.address,
        amount: smallAmountWei,
        vault: vault.address,
      });

      const additiveBalance = amountWei.add(smallAmountWei);
      expect(await otherToken.balanceOf(tokenWrapper.address)).to.eq(smallAmountWei);
      expect(await underlyingToken.balanceOf(tokenWrapper.address)).to.eq(ZERO_BI);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(additiveBalance);
      expect(await wrappedTokenFactory.balanceOf(core.dolomiteMargin.address)).to.eq(additiveBalance);
      await expectProtocolBalance(core, vault.address, toAccountNumber, underlyingMarketId, additiveBalance);
    });

    it('should fail when not called by token converter', async () => {
      await expectThrow(
        wrappedTokenFactory.connect(core.hhUser1).enqueueTransferIntoDolomiteMargin(core.hhUser1.address, amountWei),
        `WrappedTokenUserVaultFactory: Caller is not a token converter <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when cursor is already queued (developer error)', async () => {
      await wrappedTokenFactory.connect(core.hhUser1).createVault(core.hhUser1.address);
      const vaultAddress = await wrappedTokenFactory.getVaultByAccount(core.hhUser1.address);

      await wrappedTokenFactory.testEnqueueTransfer(
        vaultAddress,
        core.dolomiteMargin.address,
        amountWei,
        vaultAddress,
      );

      await wrappedTokenFactory.connect(core.governance).setIsTokenConverterTrusted(core.hhUser2.address, true);
      await expectThrow(
        wrappedTokenFactory.connect(core.hhUser2).enqueueTransferIntoDolomiteMargin(vaultAddress, amountWei),
        'WrappedTokenUserVaultFactory: Transfer is already queued',
      );
    });

    it('should fail when vault is invalid', async () => {
      await wrappedTokenFactory.connect(core.governance).setIsTokenConverterTrusted(core.hhUser3.address, true);
      await expectThrow(
        wrappedTokenFactory.connect(core.hhUser3).enqueueTransferIntoDolomiteMargin(core.hhUser4.address, amountWei),
        `WrappedTokenUserVaultFactory: Invalid vault <${core.hhUser4.address.toLowerCase()}>`,
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
      const result = await vault.depositIntoVaultForDolomiteMargin(toAccountNumber, amountWei);
      await expectEvent(wrappedTokenFactory, result, 'TransferQueued', {
        transferCursor: 0,
        from: vault.address,
        to: core.dolomiteMargin.address,
        amount: amountWei,
        vault: vault.address,
      });

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

      await wrappedTokenFactory.testEnqueueTransfer(
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

      const result = await vault.withdrawFromVaultForDolomiteMargin(toAccountNumber, amountWei);
      await expectEvent(wrappedTokenFactory, result, 'TransferQueued', {
        transferCursor: 1,
        from: core.dolomiteMargin.address,
        to: vault.address,
        amount: amountWei,
        vault: vault.address,
      });

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

      await wrappedTokenFactory.testEnqueueTransfer(
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
      const result = await wrappedTokenFactory.connect(vaultSigner)
        .liquidateWithinDolomiteMargin(tokenUnwrapper.address, amountWei);
      await expectEvent(wrappedTokenFactory, result, 'TransferQueued', {
        transferCursor: 1,
        from: core.dolomiteMargin.address,
        to: tokenUnwrapper.address,
        amount: amountWei,
        vault: vault.address,
      });

      const transferCursor = await wrappedTokenFactory.transferCursor();
      const queuedTransfer = await wrappedTokenFactory.getQueuedTransferByCursor(transferCursor);
      expect(queuedTransfer.from).to.equal(core.dolomiteMargin.address);
      expect(queuedTransfer.to).to.equal(tokenUnwrapper.address);
      expect(queuedTransfer.amount).to.equal(amountWei);
      expect(queuedTransfer.vault).to.equal(vaultAddress);
    });

    it('should fail when recipient is not a token converter', async () => {
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

      await wrappedTokenFactory.testEnqueueTransfer(
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

      await wrappedTokenFactory.testEnqueueTransfer(
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

      await wrappedTokenFactory.testEnqueueTransfer(
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
