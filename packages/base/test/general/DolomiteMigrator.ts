import { expect } from 'chai';
import {
  CustomTestToken,
  DolomiteMigrator,
  DolomiteMigrator__factory,
  IsolationModeMigrator,
  IsolationModeMigrator__factory,
  TestFailingTransformer,
  TestFailingTransformerBytes,
  TestFailingTransformerBytes__factory,
  TestFailingTransformer__factory,
  TestIsolationModeFactory,
  TestIsolationModeTokenVaultV1,
  TestIsolationModeTokenVaultV1__factory,
  TestTransformer,
  TestTransformer__factory
} from '../../src/types';
import { createContractWithAbi, createContractWithLibrary, createTestToken, depositIntoDolomiteMargin } from '../../src/utils/dolomite-utils';
import { ADDRESS_ZERO, BYTES_EMPTY, Network, ZERO_BI } from '../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { CoreProtocolArbitrumOne } from '../utils/core-protocol';
import {
  disableInterestAccrual,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupDAIBalance,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy
} from '../utils/setup';
import { expectEvent, expectProtocolBalance, expectThrow } from '../utils/assertions';
import { AccountInfoStruct } from 'packages/base/src/utils';
import { createDolomiteRegistryImplementation, createIsolationModeTokenVaultV1ActionsImpl } from '../utils/dolomite';
import { createTestIsolationModeFactory } from '../utils/ecosystem-utils/testers';
import { BigNumber } from 'ethers';
import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';

const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = BigNumber.from('123');
const borrowAccountNumber2 = BigNumber.from('124');
const amountWei = BigNumber.from('200000000000000000000'); // $200
const usdcAmount = BigNumber.from('200000000'); // $200
const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('DolomiteMigrator', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let migrator: DolomiteMigrator;
  let underlyingToken1: CustomTestToken;
  let underlyingToken2: CustomTestToken;
  let marketId1: BigNumber;
  let marketId2: BigNumber;
  let factory1: TestIsolationModeFactory;
  let factory2: TestIsolationModeFactory;
  let userVaultImplementation: TestIsolationModeTokenVaultV1;
  let migratorImplementation: IsolationModeMigrator;
  let userVault: TestIsolationModeTokenVaultV1;
  let transformer: TestTransformer;

  let accounts: AccountInfoStruct[];

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    await disableInterestAccrual(core, core.marketIds.usdc);
    await disableInterestAccrual(core, core.marketIds.dai);

    const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
    userVaultImplementation = await createContractWithLibrary(
      'TestIsolationModeTokenVaultV1',
      libraries,
      [],
    );

    underlyingToken1 = await createTestToken();
    factory1 = await createTestIsolationModeFactory(core, underlyingToken1, userVaultImplementation);
    await core.testEcosystem!.testPriceOracle.setPrice(
      factory1.address,
      '1000000000000000000', // $1.00
    );
    marketId1 = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory1, true);

    underlyingToken2 = await createTestToken();
    factory2 = await createTestIsolationModeFactory(core, underlyingToken2, userVaultImplementation);
    await core.testEcosystem!.testPriceOracle.setPrice(
      factory2.address,
      '1000000000000000000', // $1.00
    );
    marketId2 = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory2, true);

    migrator = await createContractWithAbi<DolomiteMigrator>(
      DolomiteMigrator__factory.abi,
      DolomiteMigrator__factory.bytecode,
      [core.dolomiteMargin.address, core.hhUser5.address],
    );
    migratorImplementation = await createContractWithAbi<IsolationModeMigrator>(
      IsolationModeMigrator__factory.abi,
      IsolationModeMigrator__factory.bytecode,
      [core.dolomiteRegistry.address, factory1.address, underlyingToken1.address]
    );
    transformer = await createContractWithAbi<TestTransformer>(
      TestTransformer__factory.abi,
      TestTransformer__factory.bytecode,
      [underlyingToken1.address, underlyingToken2.address]
    );
    await migrator.connect(core.governance).ownerSetTransformer(marketId1, marketId2, transformer.address);

    await factory1.connect(core.governance).ownerInitialize([]);
    await factory2.connect(core.governance).ownerInitialize([]);
    await factory1.connect(core.governance).ownerSetIsTokenConverterTrusted(migrator.address, true);
    await factory2.connect(core.governance).ownerSetIsTokenConverterTrusted(migrator.address, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory1.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory2.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(migrator.address, true);

    await factory1.createVault(core.hhUser1.address);
    const vaultAddress = await factory1.getVaultByAccount(core.hhUser1.address);
    userVault = setupUserVaultProxy<TestIsolationModeTokenVaultV1>(
      vaultAddress,
      TestIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    accounts = [
      { owner: vaultAddress, number: borrowAccountNumber }
    ];

    const newRegistry = await createDolomiteRegistryImplementation();
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(newRegistry.address);
    await core.dolomiteRegistry.ownerSetDolomiteMigrator(migrator.address);

    await setupUSDCBalance(core, core.hhUser1, usdcAmount, { address: core.dolomiteMargin.address });
    await setupDAIBalance(core, core.hhUser1, amountWei, { address: core.dolomiteMargin.address });
    await underlyingToken1.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
    await underlyingToken1.connect(core.hhUser1).approve(userVault.address, amountWei);

    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, amountWei);
    await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
    await userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await migrator.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await migrator.handler()).to.eq(core.hhUser5.address);
    });
  });

  describe('#ownerSetHandler', async () => {
    it('should work normally', async () => {
      const result = await migrator.connect(core.governance).ownerSetHandler(OTHER_ADDRESS);
      await expectEvent(migrator, result, 'HandlerSet', {
        handler: OTHER_ADDRESS,
      });
      expect(await migrator.handler()).to.eq(OTHER_ADDRESS);
    });

    it('should fail if not called owner', async () => {
      await expectThrow(
        migrator.connect(core.hhUser1).ownerSetHandler(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetTransformer', async () => {
    it('should work normally', async () => {
      const result = await migrator.connect(core.governance).ownerSetTransformer(marketId1, marketId2, OTHER_ADDRESS);
      await expectEvent(migrator, result, 'TransformerSet', {
        fromMarketId: marketId1,
        toMarketId: marketId2,
        transformer: OTHER_ADDRESS,
      });
      expect(await migrator.marketIdsToTransformer(marketId1, marketId2)).to.eq(OTHER_ADDRESS);
    });

    it('should fail if invalid transformer', async () => {
      await expectThrow(
        migrator.connect(core.governance).ownerSetTransformer(marketId1, marketId2, ADDRESS_ZERO),
        'DolomiteMigrator: Invalid transformer'
      );
    });

    it('should fail if not called owner', async () => {
      await expectThrow(
        migrator.connect(core.hhUser1).ownerSetTransformer(marketId1, marketId2, OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#migrate', () => {
    it('should work normally when user has no balances (do nothing)', async () => {
      const otherBorrowNumber = BigNumber.from('189');
      const accounts = [
        { owner: userVault.address, number: otherBorrowNumber }
      ];
      await factory1.connect(core.governance).ownerSetUserVaultImplementation(migratorImplementation.address);
      const vaultAddress = await factory2.getVaultByAccount(core.hhUser1.address);

      await expectProtocolBalance(core, userVault.address, otherBorrowNumber, marketId1, ZERO_BI);
      await expectProtocolBalance(core, vaultAddress, otherBorrowNumber, marketId2, ZERO_BI);
      const result = await migrator.connect(core.hhUser5).migrate(accounts, marketId1, marketId2, BYTES_EMPTY);
      await expectEvent(migrator, result, 'MigrationComplete', {
        accountOwner: userVault.address,
        accountNumber: otherBorrowNumber,
        fromMarketId: marketId1,
        toMarketId: marketId2,
      });
      await expectProtocolBalance(core, userVault.address, otherBorrowNumber, marketId1, ZERO_BI);
      await expectProtocolBalance(core, vaultAddress, otherBorrowNumber, marketId2, ZERO_BI);
    });

    it('should work normally when vault needs to be created', async () => {
      await factory1.connect(core.governance).ownerSetUserVaultImplementation(migratorImplementation.address);
      const result = await migrator.connect(core.hhUser5).migrate(accounts, marketId1, marketId2, BYTES_EMPTY);
      await expectEvent(migrator, result, 'MigrationComplete', {
        accountOwner: userVault.address,
        accountNumber: borrowAccountNumber,
        fromMarketId: marketId1,
        toMarketId: marketId2,
      });

      const vaultAddress = await factory2.getVaultByAccount(core.hhUser1.address);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, marketId1, ZERO_BI);
      await expectProtocolBalance(core, vaultAddress, borrowAccountNumber, marketId2, amountWei);
    });

    it('should work normally when other market balances need to be transferred', async () => {
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.usdc,
        usdcAmount,
        BalanceCheckFlag.None
      );
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.None
      );

      await factory1.connect(core.governance).ownerSetUserVaultImplementation(migratorImplementation.address);
      const result = await migrator.connect(core.hhUser5).migrate(accounts, marketId1, marketId2, BYTES_EMPTY);
      await expectEvent(migrator, result, 'MigrationComplete', {
        accountOwner: userVault.address,
        accountNumber: borrowAccountNumber,
        fromMarketId: marketId1,
        toMarketId: marketId2,
      });

      const vaultAddress = await factory2.getVaultByAccount(core.hhUser1.address);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, marketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, marketId2, ZERO_BI);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, core.marketIds.usdc, ZERO_BI);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, core.marketIds.dai, ZERO_BI);

      await expectProtocolBalance(core, vaultAddress, borrowAccountNumber, marketId1, ZERO_BI);
      await expectProtocolBalance(core, vaultAddress, borrowAccountNumber, marketId2, amountWei);
      await expectProtocolBalance(core, vaultAddress, borrowAccountNumber, core.marketIds.usdc, usdcAmount);
      await expectProtocolBalance(core, vaultAddress, borrowAccountNumber, core.marketIds.dai, amountWei);
    });

    it('should work normally when other balances but not fromMarketId need to be transferred', async () => {
      const accounts = [
        { owner: userVault.address, number: borrowAccountNumber2 }
      ];
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber2,
        core.marketIds.usdc,
        usdcAmount,
        BalanceCheckFlag.None
      );
      await factory1.connect(core.governance).ownerSetUserVaultImplementation(migratorImplementation.address);
      const result = await migrator.connect(core.hhUser5).migrate(accounts, marketId1, marketId2, BYTES_EMPTY);
      await expectEvent(migrator, result, 'MigrationComplete', {
        accountOwner: userVault.address,
        accountNumber: borrowAccountNumber2,
        fromMarketId: marketId1,
        toMarketId: marketId2,
      });

      const vaultAddress = await factory2.getVaultByAccount(core.hhUser1.address);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber2, marketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber2, marketId2, ZERO_BI);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber2, core.marketIds.usdc, ZERO_BI);

      await expectProtocolBalance(core, vaultAddress, borrowAccountNumber2, marketId1, ZERO_BI);
      await expectProtocolBalance(core, vaultAddress, borrowAccountNumber2, marketId2, ZERO_BI);
      await expectProtocolBalance(core, vaultAddress, borrowAccountNumber2, core.marketIds.usdc, usdcAmount);
    });

    it('should work normally when vault already exists', async () => {
      await factory2.createVault(core.hhUser1.address);
      await factory1.connect(core.governance).ownerSetUserVaultImplementation(migratorImplementation.address);

      const result = await migrator.connect(core.hhUser5).migrate(accounts, marketId1, marketId2, BYTES_EMPTY);
      await expectEvent(migrator, result, 'MigrationComplete', {
        accountOwner: userVault.address,
        accountNumber: borrowAccountNumber,
        fromMarketId: marketId1,
        toMarketId: marketId2,
      });
      const vaultAddress = await factory2.getVaultByAccount(core.hhUser1.address);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, marketId1, ZERO_BI);
      await expectProtocolBalance(core, vaultAddress, borrowAccountNumber, marketId2, amountWei);
    });

    it('should fail if transformer returns invalid data', async () => {
      await factory1.connect(core.governance).ownerSetUserVaultImplementation(migratorImplementation.address);
      const newTransformer = await createContractWithAbi<TestFailingTransformerBytes>(
        TestFailingTransformerBytes__factory.abi,
        TestFailingTransformerBytes__factory.bytecode,
        [underlyingToken1.address, underlyingToken2.address]
      );
      await migrator.connect(core.governance).ownerSetTransformer(marketId1, marketId2, newTransformer.address);

      await expectThrow(
        migrator.connect(core.hhUser5).migrate(accounts, marketId1, marketId2, BYTES_EMPTY),
        'DolomiteMigrator: Invalid return data'
      );
    });

    it('should fail if transformer call fails', async () => {
      await factory1.connect(core.governance).ownerSetUserVaultImplementation(migratorImplementation.address);
      const newTransformer = await createContractWithAbi<TestFailingTransformer>(
        TestFailingTransformer__factory.abi,
        TestFailingTransformer__factory.bytecode,
        [underlyingToken1.address, underlyingToken2.address]
      );
      await migrator.connect(core.governance).ownerSetTransformer(marketId1, marketId2, newTransformer.address);

      await expectThrow(
        migrator.connect(core.hhUser5).migrate(accounts, marketId1, marketId2, BYTES_EMPTY),
        'DolomiteMigrator: Transformer call failed'
      );
    });

    it('should fail if toMarketId equals fromMarketId', async () => {
      await expectThrow(
        migrator.connect(core.hhUser5).migrate(accounts, marketId1, marketId1, BYTES_EMPTY),
        'DolomiteMigrator: Cannot migrate to same market'
      );
    });

    it('should fail if fromMarketId is not an isolation mode factory', async () => {
      await expectThrow(
        migrator.connect(core.hhUser5).migrate(accounts, core.marketIds.usdc, marketId2, BYTES_EMPTY),
        'DolomiteMigrator: Markets must be isolation mode'
      );
    });

    it('should fail if toMarketId is not an isolation mode factory', async () => {
      await expectThrow(
        migrator.connect(core.hhUser5).migrate(accounts, marketId1, core.marketIds.usdc, BYTES_EMPTY),
        'DolomiteMigrator: Markets must be isolation mode'
      );
    });

    it('should fail if account is not a vault', async () => {
      const accounts = [
        { owner: core.hhUser1.address, number: defaultAccountNumber }
      ];
      await expectThrow(
        migrator.connect(core.hhUser5).migrate(accounts, marketId1, marketId2, BYTES_EMPTY),
        'DolomiteMigrator: Invalid vault'
      );
    });

    it('should fail if not called by handler', async () => {
      await expectThrow(
        migrator.connect(core.hhUser1).migrate(accounts, marketId1, marketId2, BYTES_EMPTY),
        'DolomiteMigrator: Caller is not handler'
      );
    });
  });
});
