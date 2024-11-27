import { DolomiteMigrator__factory } from '@dolomite-exchange/modules-base/src/types';
import { getDolomiteMigratorConstructorParams } from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber, impersonate } from '@dolomite-exchange/modules-base/test/utils';
import { expectProtocolBalance } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { BYTES_EMPTY, Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';
import ModuleDeployments from '../../deployments.json';

const handlerAddress = '0xdF86dFdf493bCD2b838a44726A1E58f66869ccBe'; // Level Initiator

/**
 * This script encodes the following transactions:
 * - Creates the Dolomite Migrator contract
 * - Attaches the Dolomite Migrator to the Dolomite Registry
 * - Attaches the PT-GLP (MAR 2024) transformer to the Dolomite Migrator
 * - Sets the Dolomite Migrator as a global operator on Dolomite Margin
 * - Sets the Dolomite Migrator as a trusted token converter on the PT-GLP (MAR 2024) factory
 * - Sets the Dolomite Migrator as a trusted token converter on the GLP factory
 * - Disables the old Dolomite Migrator as a global operator and trusted token converter on GLP and PT-GLP
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });
  const dPtGlp2024 = core.pendleEcosystem.glpMar2024.dPtGlpMar2024;

  const dolomiteMigratorV2Address = await deployContractAndSave(
    'DolomiteMigrator',
    getDolomiteMigratorConstructorParams(core.dolomiteMargin, core.dolomiteRegistry, handlerAddress),
    'DolomiteMigratorV2',
  );
  const dolomiteMigratorV2 = DolomiteMigrator__factory.connect(dolomiteMigratorV2Address, core.hhUser1);

  const ptGlpTransformerAddress = ModuleDeployments.PtGLPTransformerV1[network].address;
  const oldMigratorAddress = ModuleDeployments.DolomiteMigratorV1[network].address;

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.dolomiteRegistry },
      'registry',
      'ownerSetDolomiteMigrator',
      [dolomiteMigratorV2.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { migrator: dolomiteMigratorV2 },
      'migrator',
      'ownerSetTransformer',
      [
        core.marketIds.dPtGlpMar2024,
        core.marketIds.dfsGlp,
        ptGlpTransformerAddress,
        /* isSoloable = */ false,
      ],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [oldMigratorAddress, false],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: dPtGlp2024 },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [oldMigratorAddress, false],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: core.gmxEcosystem.live.dGlp },
      'factory',
      'setIsTokenConverterTrusted',
      [oldMigratorAddress, false],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [dolomiteMigratorV2.address, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: dPtGlp2024 },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [dolomiteMigratorV2.address, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: core.gmxEcosystem.live.dGlp },
      'factory',
      'setIsTokenConverterTrusted',
      [dolomiteMigratorV2.address, true],
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
        await core.dolomiteRegistry.dolomiteMigrator() === dolomiteMigratorV2.address,
        'dolomiteMigrator must be set on Dolomite Registry',
      );

      const transformerStruct = await dolomiteMigratorV2.getTransformerByMarketIds(
        core.marketIds.dPtGlpMar2024,
        core.marketIds.dfsGlp,
      );
      assertHardhatInvariant(
        !transformerStruct.soloAllowable,
        'PT-GLP transformer must not be solo-able',
      );
      assertHardhatInvariant(
        transformerStruct.transformer === ptGlpTransformerAddress,
        'PT-GLP transformer does not match',
      );

      assertHardhatInvariant(
        !(await core.dolomiteMargin.getIsGlobalOperator(oldMigratorAddress)),
        'oldMigrator must not be operator',
      );
      assertHardhatInvariant(
        !(await dPtGlp2024.isTokenConverterTrusted(oldMigratorAddress)),
        'oldMigrator must not be trusted for PT-GLP',
      );
      assertHardhatInvariant(
        !(await core.gmxEcosystem.live.dGlp.isTokenConverterTrusted(oldMigratorAddress)),
        'oldMigrator must not be trusted for GLP',
      );

      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(dolomiteMigratorV2.address),
        'dolomiteMigrator must be operator',
      );
      assertHardhatInvariant(
        await dPtGlp2024.isTokenConverterTrusted(dolomiteMigratorV2.address),
        'dolomiteMigrator must be trusted for PT-GLP',
      );
      assertHardhatInvariant(
        await core.gmxEcosystem.live.dGlp.isTokenConverterTrusted(dolomiteMigratorV2.address),
        'dolomiteMigrator must be trusted for GLP',
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

      await dolomiteMigratorV2.connect(handler).migrate(
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
