import { expect } from 'chai';
import {
  CustomTestToken,
  IsolationModeTokenVaultMigrator,
  IsolationModeTokenVaultMigrator__factory,
  TestIsolationModeVaultFactory,
  TestIsolationModeTokenVaultMigrator,
  TestIsolationModeTokenVaultMigrator__factory,
  TestIsolationModeTokenVaultV1,
} from '../../src/types';
import { createContractWithAbi, createContractWithLibrary, createTestToken } from '../../src/utils/dolomite-utils';
import { Network } from '../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../utils';
import { CoreProtocolArbitrumOne } from '../utils/core-protocol';
import {
  disableInterestAccrual,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy
} from '../utils/setup';
import { expectThrow } from '../utils/assertions';
import { createDolomiteRegistryImplementation, createIsolationModeTokenVaultV1ActionsImpl } from '../utils/dolomite';
import { createTestIsolationModeVaultFactory } from '../utils/ecosystem-utils/testers';
import { BigNumber } from 'ethers';

const amountWei = BigNumber.from('200000000000000000000'); // $200
const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('IsolationModeTokenVaultMigrator', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let underlyingToken: CustomTestToken;
  let factory: TestIsolationModeVaultFactory;
  let userVaultImplementation: TestIsolationModeTokenVaultV1;
  let migratorImplementation: IsolationModeTokenVaultMigrator;
  let userVault: IsolationModeTokenVaultMigrator;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    await disableInterestAccrual(core, core.marketIds.usdc);
    await disableInterestAccrual(core, core.marketIds.dai);

    const newRegistry = await createDolomiteRegistryImplementation();
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(newRegistry.address);
    await core.dolomiteRegistry.ownerSetDolomiteMigrator(core.hhUser5.address);

    const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
    userVaultImplementation = await createContractWithLibrary(
      'TestIsolationModeTokenVaultV1',
      libraries,
      [],
    );

    underlyingToken = await createTestToken();
    factory = await createTestIsolationModeVaultFactory(core, underlyingToken, userVaultImplementation);
    await core.testEcosystem!.testPriceOracle.setPrice(
      factory.address,
      '1000000000000000000', // $1.00
    );
    await setupTestMarket(core, factory, true);

    await factory.connect(core.governance).ownerInitialize([]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    userVault = setupUserVaultProxy<IsolationModeTokenVaultMigrator>(
      vaultAddress,
      IsolationModeTokenVaultMigrator__factory,
      core.hhUser1,
    );

    migratorImplementation = await createContractWithAbi<TestIsolationModeTokenVaultMigrator>(
      TestIsolationModeTokenVaultMigrator__factory.abi,
      TestIsolationModeTokenVaultMigrator__factory.bytecode,
      [core.dolomiteRegistry.address, underlyingToken.address, factory.address]
    );
    await factory.connect(core.governance).ownerSetUserVaultImplementation(migratorImplementation.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await userVault.DOLOMITE_REGISTRY()).to.eq(core.dolomiteRegistry.address);
      expect(await userVault.VAULT_FACTORY()).to.eq(factory.address);
    });
  });

  describe('#migrate', async () => {
    it('should work normally', async () => {
      await underlyingToken.addBalance(userVault.address, amountWei);
      await expect(() => userVault.connect(core.hhUser5).migrate(amountWei))
        .to.changeTokenBalance(underlyingToken, userVault, amountWei.mul(-1));
    });

    it('should fail if not called by migrator', async () => {
      await expectThrow(
        userVault.connect(core.hhUser1).migrate(amountWei),
        `IsolationModeTokenVaultMigrator: Caller is not migrator <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeWithdrawalFromVault', async () => {
    it('should work normally (do nothing)', async () => {
      const factoryImpersonator = await impersonate(factory.address, true);
      const preBal = await underlyingToken.balanceOf(userVault.address);
      await userVault.connect(factoryImpersonator).executeWithdrawalFromVault(OTHER_ADDRESS, amountWei);
      expect(await underlyingToken.balanceOf(userVault.address)).to.eq(preBal);
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        userVault.executeWithdrawalFromVault(OTHER_ADDRESS, amountWei),
        'IsolationModeTokenVaultMigrator: Only factory can call'
      );
    });
  });
});
