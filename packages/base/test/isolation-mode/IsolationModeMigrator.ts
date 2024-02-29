import { expect } from 'chai';
import {
  CustomTestToken,
  IsolationModeMigrator,
  IsolationModeMigrator__factory,
  TestIsolationModeFactory,
  TestIsolationModeTokenVaultV1,
} from '../../src/types';
import { createContractWithAbi, createContractWithLibrary, createTestToken } from '../../src/utils/dolomite-utils';
import { Network } from '../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
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
import { createTestIsolationModeFactory } from '../utils/ecosystem-utils/testers';
import { BigNumber } from 'ethers';

const amountWei = BigNumber.from('200000000000000000000'); // $200
const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('IsolationModeMigrator', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let underlyingToken: CustomTestToken;
  let factory: TestIsolationModeFactory;
  let userVaultImplementation: TestIsolationModeTokenVaultV1;
  let migratorImplementation: IsolationModeMigrator;
  let userVault: IsolationModeMigrator;

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
    factory = await createTestIsolationModeFactory(core, underlyingToken, userVaultImplementation);
    await core.testEcosystem!.testPriceOracle.setPrice(
      factory.address,
      '1000000000000000000', // $1.00
    );
    await setupTestMarket(core, factory, true);

    await factory.connect(core.governance).ownerInitialize([]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    userVault = setupUserVaultProxy<IsolationModeMigrator>(
      vaultAddress,
      IsolationModeMigrator__factory,
      core.hhUser1,
    );

    migratorImplementation = await createContractWithAbi<IsolationModeMigrator>(
      IsolationModeMigrator__factory.abi,
      IsolationModeMigrator__factory.bytecode,
      [core.dolomiteRegistry.address, factory.address, underlyingToken.address]
    );
    await factory.connect(core.governance).ownerSetUserVaultImplementation(migratorImplementation.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await userVault.dolomiteRegistry()).to.eq(core.dolomiteRegistry.address);
      expect(await userVault.vaultFactory()).to.eq(factory.address);
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
        `IsolationModeMigrator: Caller is not migrator <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeWithdrawalFromVault', async () => {
    it('should work normally (do nothing)', async () => {
      await expect(() => userVault.executeWithdrawalFromVault(OTHER_ADDRESS, amountWei))
        .to.changeTokenBalance(underlyingToken, userVault, 0);
    });
  });
});
