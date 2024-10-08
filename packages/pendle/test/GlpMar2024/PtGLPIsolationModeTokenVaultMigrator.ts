import {
  DolomiteMigrator,
  DolomiteMigrator__factory,
  IsolationModeTokenVaultMigrator,
  IsolationModeTokenVaultMigrator__factory,
} from '@dolomite-exchange/modules-base/src/types';
import {
  getIsolationModeTokenVaultMigratorConstructorParams,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectProtocolBalance } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { createDolomiteRegistryImplementation } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import { disableInterestAccrual, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { AccountInfoStruct } from 'packages/base/src/utils';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { IGLPIsolationModeVaultFactoryOld } from 'packages/glp/src/types';
import {
  PendlePtGLPMar2024IsolationModeVaultFactory,
  PtGLPTransformer,
  PtGLPTransformer__factory,
} from 'packages/pendle/src/types';

const defaultAccountNumber = ZERO_BI;
const vaultAddress = '0x10dc4c2c391de5008bc4c895c3b1c3b070661674';
const vaultOwner = '0x9958Ed7f2441c208821Ea14643224812A006D221';
const vaultAddress2 = '0x02f78ebb68d234c0c7fe94b85de39d21d1102f6b';
const vaultOwner2 = '0x8A8841F4AB46A052139e0DE31B1e693382193813';
const borrowAccount1 = BigNumber.from('4211115166896119896340262904855120100885563956626545700858695746739717416654');
const borrowAccount2 = BigNumber.from('54588878184938659795385687626756517841802839253616459311414872509276303196718');

const integrationAccounts: AccountInfoStruct[] = [
  { owner: vaultAddress, number: defaultAccountNumber },
  { owner: vaultAddress2, number: borrowAccount1 },
  { owner: vaultAddress2, number: borrowAccount2 },
];

describe('PtGLPIsolationModeTokenVaultMigrator', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let migrator: DolomiteMigrator;
  let glpFactory: IGLPIsolationModeVaultFactoryOld;
  let ptGlpFactory: PendlePtGLPMar2024IsolationModeVaultFactory;
  let tokenVaultMigratorImplementation: IsolationModeTokenVaultMigrator;
  let transformer: PtGLPTransformer;

  let accounts: AccountInfoStruct[];

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 195_821_400, // This is block prior to vault removing the tokens
      network: Network.ArbitrumOne,
    });
    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.wbtc);

    ptGlpFactory = core.pendleEcosystem.glpMar2024.dPtGlpMar2024.connect(core.hhUser1);
    glpFactory = core.gmxEcosystem!.live.dGlp.connect(core.hhUser1);

    migrator = await createContractWithAbi<DolomiteMigrator>(
      DolomiteMigrator__factory.abi,
      DolomiteMigrator__factory.bytecode,
      [core.dolomiteMargin.address, core.hhUser5.address],
    );
    tokenVaultMigratorImplementation = await createContractWithAbi<IsolationModeTokenVaultMigrator>(
      IsolationModeTokenVaultMigrator__factory.abi,
      IsolationModeTokenVaultMigrator__factory.bytecode,
      getIsolationModeTokenVaultMigratorConstructorParams(core, core.pendleEcosystem.glpMar2024.ptGlpToken),
    );
    transformer = await createContractWithAbi<PtGLPTransformer>(
      PtGLPTransformer__factory.abi,
      PtGLPTransformer__factory.bytecode,
      [await ptGlpFactory.pendlePtGLP2024Registry(), core.gmxEcosystem.sGlp.address],
    );

    const newRegistry = await createDolomiteRegistryImplementation();
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(newRegistry.address);
    await core.dolomiteRegistry.ownerSetDolomiteMigrator(migrator.address);

    await migrator.connect(core.governance).ownerSetTransformer(
      core.marketIds.dPtGlpMar2024,
      core.marketIds.dfsGlp,
      transformer.address,
      false,
    );
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(migrator.address, true);
    await ptGlpFactory.connect(core.governance).ownerSetIsTokenConverterTrusted(migrator.address, true);
    await glpFactory.connect(core.governance).setIsTokenConverterTrusted(migrator.address, true);
    await ptGlpFactory.connect(core.governance)
      .ownerSetUserVaultImplementation(tokenVaultMigratorImplementation.address);

    accounts = [
      { owner: vaultAddress, number: defaultAccountNumber },
    ];

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await transformer.PENDLE_REGISTRY()).to.eq(await ptGlpFactory.pendlePtGLP2024Registry());
    });
  });

  describe('#transform', () => {
    it('should work normally', async () => {
      const ptGlpAmountWei = (await core.dolomiteMargin.getAccountWei(
        { owner: vaultAddress, number: defaultAccountNumber },
        core.marketIds.dPtGlpMar2024,
      )).value;

      await migrator.connect(core.hhUser5).migrate(
        accounts,
        core.marketIds.dPtGlpMar2024,
        core.marketIds.dfsGlp,
        BYTES_EMPTY,
      );

      const glpVaultAddress = await glpFactory.getVaultByAccount(vaultOwner);
      await expectProtocolBalance(core, vaultAddress, defaultAccountNumber, core.marketIds.dPtGlpMar2024, ZERO_BI);
      await expectProtocolBalance(
        core,
        glpVaultAddress,
        defaultAccountNumber,
        core.marketIds.dfsGlp,
        ptGlpAmountWei,
      );
    });

    it('should work normally for integration accounts', async () => {
      const ptGlpAmountWei = (await core.dolomiteMargin.getAccountWei(
        { owner: vaultAddress, number: defaultAccountNumber },
        core.marketIds.dPtGlpMar2024,
      )).value;

      const supplyAmount = await core.dolomiteMargin.getAccountWei(
        { owner: '0x02f78ebb68d234c0c7fe94b85de39d21d1102f6b', number: borrowAccount1 },
        core.marketIds.dPtGlpMar2024,
      );
      const supplyAmount2 = await core.dolomiteMargin.getAccountWei(
        { owner: '0x02f78ebb68d234c0c7fe94b85de39d21d1102f6b', number: borrowAccount2 },
        core.marketIds.dPtGlpMar2024,
      );

      const borrowAmountWeth1 = await core.dolomiteMargin.getAccountWei(
        { owner: vaultAddress2, number: borrowAccount1 },
        core.marketIds.weth,
      );
      const borrowAmountWbtc1 = await core.dolomiteMargin.getAccountWei(
        { owner: vaultAddress2, number: borrowAccount1 },
        core.marketIds.wbtc,
      );
      const borrowAmountUsdc2 = await core.dolomiteMargin.getAccountWei(
        { owner: vaultAddress2, number: borrowAccount2 },
        core.marketIds.nativeUsdc,
      );
      await migrator.connect(core.hhUser5).migrate(
        integrationAccounts,
        core.marketIds.dPtGlpMar2024,
        core.marketIds.dfsGlp,
        BYTES_EMPTY,
      );

      const glpVaultAddress = await glpFactory.getVaultByAccount(vaultOwner);
      const glpVaultAddress2 = await glpFactory.getVaultByAccount(vaultOwner2);
      await expectProtocolBalance(core, vaultAddress, defaultAccountNumber, core.marketIds.dPtGlpMar2024, ZERO_BI);
      await expectProtocolBalance(
        core,
        glpVaultAddress,
        defaultAccountNumber,
        core.marketIds.dfsGlp,
        ptGlpAmountWei,
      );

      await expectProtocolBalance(core, vaultAddress2, borrowAccount1, core.marketIds.dPtGlpMar2024, ZERO_BI);
      await expectProtocolBalance(core, vaultAddress2, borrowAccount1, core.marketIds.wbtc, ZERO_BI);
      await expectProtocolBalance(core, vaultAddress2, borrowAccount1, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(
        core,
        glpVaultAddress2,
        borrowAccount1,
        core.marketIds.wbtc,
        ZERO_BI.sub(borrowAmountWbtc1.value),
      );
      await expectProtocolBalance(
        core,
        glpVaultAddress2,
        borrowAccount1,
        core.marketIds.weth,
        ZERO_BI.sub(borrowAmountWeth1.value),
      );
      await expectProtocolBalance(core, glpVaultAddress2, borrowAccount1, core.marketIds.dfsGlp, supplyAmount.value);

      await expectProtocolBalance(core, vaultAddress2, borrowAccount2, core.marketIds.dPtGlpMar2024, ZERO_BI);
      await expectProtocolBalance(core, glpVaultAddress2, borrowAccount2, core.marketIds.dfsGlp, supplyAmount2.value);
      await expectProtocolBalance(
        core,
        glpVaultAddress2,
        borrowAccount2,
        core.marketIds.nativeUsdc,
        ZERO_BI.sub(borrowAmountUsdc2.value),
      );
    });
  });
});
