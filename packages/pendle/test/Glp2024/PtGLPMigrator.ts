import { expect } from 'chai';
import {
  IsolationModeMigrator,
  IsolationModeMigrator__factory,
} from '@dolomite-exchange/modules-base/src/types';
import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import {
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { BaseRouter, Router } from '@pendle/sdk-v2';
import { expectProtocolBalance, expectProtocolBalanceIsGreaterThan } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { AccountInfoStruct } from 'packages/base/src/utils';
import { createDolomiteRegistryImplementation } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import { IGLPIsolationModeVaultFactoryOld } from 'packages/glp/src/types';
import {
  PendlePtGLP2024IsolationModeVaultFactory,
  PtGLPMigrator,
  PtGLPMigrator__factory,
  PtGLPTransformer,
  PtGLPTransformer__factory
} from 'packages/pendle/src/types';
import { ONE_TENTH_OF_ONE_BIPS_NUMBER, encodeSwapExactPtForTokens } from '../pendle-utils';
import { CHAIN_ID_MAPPING } from '@pendle/sdk-v2';

const defaultAccountNumber = ZERO_BI;
const vaultAddress = '0x10dc4c2c391de5008bc4c895c3b1c3b070661674';
const vaultOwner = '0x9958Ed7f2441c208821Ea14643224812A006D221';

describe('PtGLPMigrator', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let migrator: PtGLPMigrator;
  let glpFactory: IGLPIsolationModeVaultFactoryOld;
  let ptGlpFactory: PendlePtGLP2024IsolationModeVaultFactory;
  let migratorImplementation: IsolationModeMigrator;
  let transformer: PtGLPTransformer;
  let router: BaseRouter;

  let accounts: AccountInfoStruct[];

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));

    ptGlpFactory = core.pendleEcosystem.glpMar2024.dPtGlp2024.connect(core.hhUser1);
    glpFactory = core.gmxEcosystem!.live.dGlp.connect(core.hhUser1);

    migrator = await createContractWithAbi<PtGLPMigrator>(
      PtGLPMigrator__factory.abi,
      PtGLPMigrator__factory.bytecode,
      [core.dolomiteMargin.address, core.hhUser5.address],
    );
    migratorImplementation = await createContractWithAbi<IsolationModeMigrator>(
      IsolationModeMigrator__factory.abi,
      IsolationModeMigrator__factory.bytecode,
      [core.dolomiteRegistry.address, ptGlpFactory.address]
    );
    transformer = await createContractWithAbi<PtGLPTransformer>(
      PtGLPTransformer__factory.abi,
      PtGLPTransformer__factory.bytecode,
      [await ptGlpFactory.pendlePtGLP2024Registry()]
    );

    router = Router.getRouter({
      chainId: CHAIN_ID_MAPPING.ARBITRUM,
      provider: core.hhUser1.provider,
      signer: core.hhUser1,
    });

    const newRegistry = await createDolomiteRegistryImplementation();
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(newRegistry.address);
    await core.dolomiteRegistry.ownerSetDolomiteMigrator(migrator.address);
    await migrator.connect(core.governance).ownerSetTransformer(core.marketIds.dPtGlp, core.marketIds.dfsGlp, transformer.address);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(migrator.address, true);
    await ptGlpFactory.connect(core.governance).ownerSetIsTokenConverterTrusted(migrator.address, true);
    await glpFactory.connect(core.governance).setIsTokenConverterTrusted(migrator.address, true);

    accounts = [
      { owner: vaultAddress, number: defaultAccountNumber }
    ];

    await ptGlpFactory.connect(core.governance).ownerSetUserVaultImplementation(migratorImplementation.address);

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
      const ptGlpAmountWei = (await core.dolomiteMargin.getAccountWei( { owner: vaultAddress, number: defaultAccountNumber }, core.marketIds.dPtGlp)).value;
      const { tokenOutput, extraOrderData } = await encodeSwapExactPtForTokens(
        router,
        ptGlpAmountWei,
        ONE_TENTH_OF_ONE_BIPS_NUMBER,
        core.pendleEcosystem.glpMar2024.ptGlpMarket.address,
        core.gmxEcosystem.sGlp.address,
      );
      await migrator.connect(core.hhUser5).migrate(accounts, core.marketIds.dPtGlp, core.marketIds.dfsGlp, extraOrderData);

      const glpVaultAddress = await glpFactory.getVaultByAccount(vaultOwner);
      await expectProtocolBalance(core, vaultAddress, defaultAccountNumber, core.marketIds.dPtGlp, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(core, { owner: glpVaultAddress, number: defaultAccountNumber }, core.marketIds.dfsGlp, tokenOutput.minTokenOut, ZERO_BI);
    });
  })
});
