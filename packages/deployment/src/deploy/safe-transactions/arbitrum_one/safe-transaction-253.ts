import { DolomiteMigrator__factory } from '@dolomite-exchange/modules-base/src/types';
import {
  getIsolationModeTokenVaultMigratorConstructorParams,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber, impersonate } from '@dolomite-exchange/modules-base/test/utils';
import { expectProtocolBalance } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { BYTES_EMPTY, Network, ONE_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

const handlerAddress = '0xdF86dFdf493bCD2b838a44726A1E58f66869ccBe'; // Level Initiator

/**
 * This script encodes the following transactions:
 * - Creates the Dolomite Migrator contract
 * - Creates the PT-GLP (MAR 2024) token vault migrator
 * - Creates the PT-GLP (MAR 2024) transformer
 * - Creates the new Dolomite Registry
 * - Attaches the Dolomite Migrator to the new Dolomite Registry implementation
 * - Attaches the PT-GLP (MAR 2024) transformer to the Dolomite Migrator
 * - Sets the Dolomite Migrator as a global operator on Dolomite Margin
 * - Sets the Dolomite Migrator as a trusted token converter on the PT-GLP (MAR 2024) factory
 * - Sets the Dolomite Migrator as a trusted token converter on the GLP factory
 * - Attaches the PT-GLP (MAR 2024) token vault migrator to the PT-GLP (MAR 2024) factory
 * - Lowers the supply cap of PT-GLP (MAR 2024) to 1 unit
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });
  const dPtGlp2024 = core.pendleEcosystem.glpMar2024.dPtGlp2024;

  const dolomiteMigratorAddress = await deployContractAndSave(
    'DolomiteMigrator',
    [core.dolomiteMargin.address, handlerAddress],
    'DolomiteMigratorV1',
  );
  const dolomiteMigrator = DolomiteMigrator__factory.connect(dolomiteMigratorAddress, core.hhUser1);

  const isolationModeTokenVaultMigratorV1Address = await deployContractAndSave(
    'IsolationModeTokenVaultMigrator',
    getIsolationModeTokenVaultMigratorConstructorParams(core, core.pendleEcosystem.glpMar2024.ptGlpToken),
    'PtGLPMar2024IsolationModeTokenVaultMigrator',
  );

  const transformerAddress = await deployContractAndSave(
    'PtGLPTransformer',
    [core.pendleEcosystem.glpMar2024.pendleRegistryProxy.address, core.gmxEcosystem.sGlp.address],
    'PtGLPTransformerV1',
  );

  const dolomiteRegistryImplementationV9Address = await deployContractAndSave(
    'DolomiteRegistryImplementation',
    [],
    'DolomiteRegistryImplementationV9',
  );

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registryProxy: core.dolomiteRegistryProxy },
      'registryProxy',
      'upgradeTo',
      [dolomiteRegistryImplementationV9Address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.dolomiteRegistry },
      'registry',
      'ownerSetDolomiteMigrator',
      [dolomiteMigrator.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { migrator: dolomiteMigrator },
      'migrator',
      'ownerSetTransformer',
      [
        core.marketIds.dPtGlpMar2024,
        core.marketIds.dfsGlp,
        transformerAddress,
        false,
      ],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [dolomiteMigrator.address, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: dPtGlp2024 },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [dolomiteMigrator.address, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: core.gmxEcosystem.live.dGlp },
      'factory',
      'setIsTokenConverterTrusted',
      [dolomiteMigrator.address, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: dPtGlp2024 },
      'factory',
      'ownerSetUserVaultImplementation',
      [isolationModeTokenVaultMigratorV1Address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomite: core.dolomiteMargin },
      'dolomite',
      'ownerSetMaxWei',
      [core.marketIds.dPtGlpMar2024, ONE_BI],
    ),
  ];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    invariants: async () => {
      assertHardhatInvariant(
        await core.dolomiteRegistry.dolomiteMigrator() === dolomiteMigrator.address,
        'dolomiteMigrator must be set on Dolomite Registry',
      );

      const transformerStruct = await dolomiteMigrator.marketIdsToTransformer(
        core.marketIds.dPtGlpMar2024,
        core.marketIds.dfsGlp,
      );
      assertHardhatInvariant(
        !transformerStruct.soloAllowable,
        'PT-GLP transformer must not be solo-able',
      );
      assertHardhatInvariant(
        transformerStruct.transformer === transformerAddress,
        'PT-GLP transformer does not match',
      );

      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(dolomiteMigrator.address),
        'dolomiteMigrator must be operator',
      );

      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketMaxWei(core.marketIds.dPtGlpMar2024)).value.eq(ONE_BI),
        'PT-GLP (MAR 2024) supply cap must equal 1 unit',
      );

      assertHardhatInvariant(
        await dPtGlp2024.isTokenConverterTrusted(dolomiteMigrator.address),
        'dolomiteMigrator must be trusted for PT-GLP',
      );

      assertHardhatInvariant(
        await core.gmxEcosystem.live.dGlp.isTokenConverterTrusted(dolomiteMigrator.address),
        'dolomiteMigrator must be trusted for GLP',
      );

      assertHardhatInvariant(
        await dPtGlp2024.userVaultImplementation()
        === isolationModeTokenVaultMigratorV1Address,
        'isolationModeTokenVaultMigratorV1 must be set on PT-GLP factory',
      );

      const handler = await impersonate(handlerAddress);
      const integrationAccounts = [{ owner: '0xb5dd5cfa0577b53aeb7b6ed4662794d5a44affbe', number: 0 }];
      const accountOwner = await dPtGlp2024.getAccountByVault(integrationAccounts[0].owner);
      const glpVaultAddress = await core.gmxEcosystem.live.dGlp.getVaultByAccount(accountOwner);

      const ptGlpAmountWeiBefore = (await core.dolomiteMargin.getAccountWei(
        integrationAccounts[0],
        core.marketIds.dPtGlpMar2024,
      )).value;
      const glpAmountWeiBefore = (await core.dolomiteMargin.getAccountWei(
        { owner: glpVaultAddress, number: integrationAccounts[0].number },
        core.marketIds.dfsGlp,
      )).value;
      console.log('\tPT-GLP (MAR 2024) balance before:', ptGlpAmountWeiBefore.toString());
      console.log('\tGLP balance before:', glpAmountWeiBefore.toString());

      await dolomiteMigrator.connect(handler).migrate(
        integrationAccounts,
        core.marketIds.dPtGlpMar2024,
        core.marketIds.dfsGlp,
        BYTES_EMPTY,
      );

      const ptGlpAmountWeiAfter = (await core.dolomiteMargin.getAccountWei(
        integrationAccounts[0],
        core.marketIds.dPtGlpMar2024,
      )).value;
      const glpAmountWeiAfter = (await core.dolomiteMargin.getAccountWei(
        { owner: glpVaultAddress, number: integrationAccounts[0].number },
        core.marketIds.dfsGlp,
      )).value;
      console.log('\tPT-GLP (MAR 2024) balance after:', ptGlpAmountWeiAfter.toString());
      console.log('\tGLP balance after:', glpAmountWeiAfter.toString());

      await expectProtocolBalance(
        core,
        integrationAccounts[0].owner,
        integrationAccounts[0].number,
        core.marketIds.dPtGlpMar2024,
        ZERO_BI,
      );
      await expectProtocolBalance(
        core,
        glpVaultAddress,
        integrationAccounts[0].number,
        core.marketIds.dfsGlp,
        ptGlpAmountWeiBefore.add(glpAmountWeiBefore),
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
