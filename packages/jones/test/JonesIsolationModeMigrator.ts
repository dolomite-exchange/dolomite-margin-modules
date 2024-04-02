import { expect } from 'chai';
import {
  CustomTestToken,
  DolomiteMigrator,
  DolomiteMigrator__factory,
  TestIsolationModeFactory,
} from '@dolomite-exchange/modules-base/src/types';
import { createContractWithAbi, createTestToken } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, BYTES_EMPTY, Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import {
  disableInterestAccrual,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expectEvent, expectProtocolBalance } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { AccountInfoStruct } from 'packages/base/src/utils';
import { createDolomiteRegistryImplementation } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import { createTestIsolationModeFactory, createTestIsolationModeTokenVaultV1 } from '@dolomite-exchange/modules-base/test/utils/ecosystem-utils/testers';
import { BigNumber } from 'ethers';
import {
  IJonesUSDCRegistry,
  JonesIsolationModeMigrator,
  JonesIsolationModeMigrator__factory,
  JonesUSDCIsolationModeTokenVaultV2,
  JonesUSDCIsolationModeTokenVaultV2__factory,
  JonesUSDCTransformer,
  JonesUSDCTransformer__factory
} from '../src/types';

const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = BigNumber.from('1459905207403129169267937088594887067712932414205099848310575336716887654304');
const USER_ACCOUNT = '0x52256ef863a713Ef349ae6E97A7E8f35785145dE';

describe('JonesIsolationModeMigrator', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let migrator: DolomiteMigrator;
  let newjUSDC: CustomTestToken;
  let marketId: BigNumber;
  let factory: TestIsolationModeFactory;
  let migratorImplementation: JonesIsolationModeMigrator;
  let userVault: JonesUSDCIsolationModeTokenVaultV2;
  let transformer: JonesUSDCTransformer;
  let jonesUSDCRegistry: IJonesUSDCRegistry;

  let accounts: AccountInfoStruct[];

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 196_200_000,
      network: Network.ArbitrumOne
    });
    await disableInterestAccrual(core, core.marketIds.usdc);

    const userVaultImplementation = await createTestIsolationModeTokenVaultV1();
    newjUSDC = await createTestToken();
    factory = await createTestIsolationModeFactory(core, newjUSDC, userVaultImplementation);
    await core.testEcosystem!.testPriceOracle.setPrice(
      factory.address,
      '1000000000000000000', // $1.00
    );
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);

    migrator = await createContractWithAbi<DolomiteMigrator>(
      DolomiteMigrator__factory.abi,
      DolomiteMigrator__factory.bytecode,
      [core.dolomiteMargin.address, core.hhUser5.address],
    );
    migratorImplementation = await createContractWithAbi<JonesIsolationModeMigrator>(
      JonesIsolationModeMigrator__factory.abi,
      JonesIsolationModeMigrator__factory.bytecode,
      [core.jonesEcosystem.live.jonesUSDCRegistry.address, core.dolomiteRegistry.address, factory.address, core.jonesEcosystem!.jUSDC.address]
    );
    transformer = await createContractWithAbi<JonesUSDCTransformer>(
      JonesUSDCTransformer__factory.abi,
      JonesUSDCTransformer__factory.bytecode,
      [core.jonesEcosystem.jUSDC.address, newjUSDC.address, core.jonesEcosystem.router.address]
    );
    await migrator.connect(core.governance).ownerSetTransformer(core.marketIds.djUSDC, marketId, transformer.address);

    await factory.connect(core.governance).ownerInitialize([]);
    await factory.connect(core.governance).ownerSetIsTokenConverterTrusted(migrator.address, true);
    await core.jonesEcosystem.live.jUSDCIsolationModeFactory.connect(core.governance).ownerSetIsTokenConverterTrusted(migrator.address, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(migrator.address, true);

    const vaultAddress = await core.jonesEcosystem.live.jUSDCIsolationModeFactory.getVaultByAccount(USER_ACCOUNT);
    const userImpersonator = await impersonate(USER_ACCOUNT, true);
    userVault = setupUserVaultProxy<JonesUSDCIsolationModeTokenVaultV2>(
      vaultAddress,
      JonesUSDCIsolationModeTokenVaultV2__factory,
      userImpersonator,
    );
    accounts = [
      { owner: vaultAddress, number: defaultAccountNumber },
      { owner: vaultAddress, number: borrowAccountNumber }
    ];

    const newRegistry = await createDolomiteRegistryImplementation();
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(newRegistry.address);
    await core.dolomiteRegistry.ownerSetDolomiteMigrator(migrator.address);

    const compoundUVRT = BigNumber.from('3021493084998000546098497');
    const stableVaultTotalSupply = BigNumber.from('5385659097882000000000000');
    const jUSDCAmount = BigNumber.from('2704988861998979196642458');
    const routerAdmin = await impersonate('0xc8ce0aC725f914dBf1D743D51B6e222b79F479f1', true);

    await core.jonesEcosystem.router.connect(routerAdmin).initialize(
      '0x2F43c6475f1ecBD051cE486A9f3Ccc4b03F3d713',
      '0xEB23C7e19DB72F9a728fD64E1CAA459E457cfaca',
      '0x2ACc798DA9487fdD7F4F653e04D8E8411cd73e88',
      '0x2ACc798DA9487fdD7F4F653e04D8E8411cd73e88',
      newjUSDC.address,
      ADDRESS_ZERO,
      compoundUVRT,
      stableVaultTotalSupply.sub(compoundUVRT),
      jUSDCAmount
    );
    await core.jonesEcosystem.whitelistController.connect(routerAdmin).addToWhitelistContracts(migrator.address);

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

  describe('#migrate', () => {
    it('should work normally when user has no balances (do nothing)', async () => {
      await core.jonesEcosystem.live.jUSDCIsolationModeFactory.connect(core.governance).ownerSetUserVaultImplementation(migratorImplementation.address);
      const otherBorrowNumber = BigNumber.from('189');
      const accounts = [
        { owner: userVault.address, number: otherBorrowNumber }
      ];
      const result = await migrator.connect(core.hhUser5).migrate(accounts, core.marketIds.djUSDC, marketId, BYTES_EMPTY);
      await expectEvent(migrator, result, 'MigrationComplete', {
        accountOwner: userVault.address,
        accountNumber: otherBorrowNumber,
        fromMarketId: core.marketIds.djUSDC,
        toMarketId: marketId,
      });

      const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
      await expectProtocolBalance(core, userVault.address, otherBorrowNumber, core.marketIds.djUSDC, ZERO_BI);
      await expectProtocolBalance(core, vaultAddress, otherBorrowNumber, marketId, ZERO_BI);
    });

    it('should work normally when user has staked and non-staked balance', async () => {
      await core.jonesEcosystem.live.jUSDCIsolationModeFactory.connect(core.governance).ownerSetUserVaultImplementation(migratorImplementation.address);
      const defaultAmount = await core.dolomiteMargin.getAccountWei({ owner: userVault.address, number: defaultAccountNumber }, core.marketIds.djUSDC);
      const collateralAmount = await core.dolomiteMargin.getAccountWei({ owner: userVault.address, number: borrowAccountNumber }, core.marketIds.djUSDC);
      const borrowAmount = await core.dolomiteMargin.getAccountWei({ owner: userVault.address, number: borrowAccountNumber }, core.marketIds.usdc);
      const result = await migrator.connect(core.hhUser5).migrate(accounts, core.marketIds.djUSDC, marketId, BYTES_EMPTY);
      await expectEvent(migrator, result, 'MigrationComplete', {
        accountOwner: userVault.address,
        accountNumber: defaultAccountNumber,
        fromMarketId: core.marketIds.djUSDC,
        toMarketId: marketId,
      });

      const vaultAddress = await factory.getVaultByAccount(USER_ACCOUNT);
      await expectProtocolBalance(core, userVault.address, defaultAccountNumber, core.marketIds.djUSDC, ZERO_BI);
      await expectProtocolBalance(core, vaultAddress, defaultAccountNumber, marketId, defaultAmount.value);

      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, core.marketIds.djUSDC, ZERO_BI);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, core.marketIds.usdc, ZERO_BI);
      await expectProtocolBalance(core, vaultAddress, borrowAccountNumber, marketId, collateralAmount.value);
      await expectProtocolBalance(core, vaultAddress, borrowAccountNumber, core.marketIds.usdc, ZERO_BI.sub(borrowAmount.value));
    });

    it('should work normally when user has no staked balance', async () => {
      const amount = await userVault.stakedBalanceOf();
      await userVault.unstake(amount);

      await core.jonesEcosystem.live.jUSDCIsolationModeFactory.connect(core.governance).ownerSetUserVaultImplementation(migratorImplementation.address);
      const defaultAmount = await core.dolomiteMargin.getAccountWei({ owner: userVault.address, number: defaultAccountNumber }, core.marketIds.djUSDC);
      const collateralAmount = await core.dolomiteMargin.getAccountWei({ owner: userVault.address, number: borrowAccountNumber }, core.marketIds.djUSDC);
      const borrowAmount = await core.dolomiteMargin.getAccountWei({ owner: userVault.address, number: borrowAccountNumber }, core.marketIds.usdc);
      const result = await migrator.connect(core.hhUser5).migrate(accounts, core.marketIds.djUSDC, marketId, BYTES_EMPTY);
      await expectEvent(migrator, result, 'MigrationComplete', {
        accountOwner: userVault.address,
        accountNumber: defaultAccountNumber,
        fromMarketId: core.marketIds.djUSDC,
        toMarketId: marketId,
      });

      const vaultAddress = await factory.getVaultByAccount(USER_ACCOUNT);
      await expectProtocolBalance(core, userVault.address, defaultAccountNumber, core.marketIds.djUSDC, ZERO_BI);
      await expectProtocolBalance(core, vaultAddress, defaultAccountNumber, marketId, defaultAmount.value);

      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, core.marketIds.djUSDC, ZERO_BI);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, core.marketIds.usdc, ZERO_BI);
      await expectProtocolBalance(core, vaultAddress, borrowAccountNumber, marketId, collateralAmount.value);
      await expectProtocolBalance(core, vaultAddress, borrowAccountNumber, core.marketIds.usdc, ZERO_BI.sub(borrowAmount.value));
    });
  });
});
