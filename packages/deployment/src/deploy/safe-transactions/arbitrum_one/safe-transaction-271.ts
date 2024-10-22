import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber, impersonate } from '@dolomite-exchange/modules-base/test/utils';
import { expectProtocolBalance } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { initializeNewJUsdc } from '@dolomite-exchange/modules-base/test/utils/ecosystem-utils/jones';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  getJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidationConstructorParams,
  getJonesUSDCIsolationModeUnwrapperTraderV2ForZapConstructorParams,
  getJonesUSDCIsolationModeVaultFactoryConstructorParams,
  getJonesUSDCIsolationModeWrapperTraderV2ConstructorParams,
  getJonesUSDCRegistryConstructorParams,
  getJonesUSDCWithChainlinkAutomationPriceOracleConstructorParams,
} from '@dolomite-exchange/modules-jones/src/jones-construtors';
import {
  JonesUSDCIsolationModeTokenVaultV1__factory,
  JonesUSDCIsolationModeUnwrapperTraderV2__factory,
  JonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation__factory,
  JonesUSDCIsolationModeWrapperTraderV2__factory,
  JonesUSDCRegistry__factory,
  JonesUSDCV2IsolationModeVaultFactory__factory,
  JonesUSDCWithChainlinkAutomationPriceOracle__factory,
} from '@dolomite-exchange/modules-jones/src/types';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { BYTES_EMPTY, Network, ONE_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodeAddIsolationModeMarket,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

const handlerAddress = '0xdF86dFdf493bCD2b838a44726A1E58f66869ccBe'; // Level Initiator

/**
 * This script encodes the following transactions:
 * - Deploys the new jUSDC
 * - Initializes the migrator for old jUSDC to new
 * - Disables the old jUSDC
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });
  const dJusdcOld = core.jonesEcosystem.live.jUSDCV1IsolationModeFactory;

  const jUsdcRegistryImplementationAddress = await deployContractAndSave(
    'JonesUSDCRegistry',
    [],
    'JonesUSDCV2RegistryImplementationV1',
  );
  const jUsdcRegistryImplementation = JonesUSDCRegistry__factory.connect(
    jUsdcRegistryImplementationAddress,
    core.hhUser1,
  );
  const jUsdcRegistryProxyAddress = await deployContractAndSave(
    'RegistryProxy',
    await getJonesUSDCRegistryConstructorParams(jUsdcRegistryImplementation, core),
    'JonesUSDCV2RegistryProxy',
  );
  const jUsdcRegistryProxy = JonesUSDCRegistry__factory.connect(jUsdcRegistryProxyAddress, core.hhUser1);

  const jUsdcUserVaultImplementationAddress = await deployContractAndSave(
    'JonesUSDCIsolationModeTokenVaultV1',
    [],
    'JonesUSDCV2IsolationModeTokenVaultV1',
    core.libraries.tokenVaultActionsImpl,
  );
  const jUsdcUserVaultImplementation = JonesUSDCIsolationModeTokenVaultV1__factory.connect(
    jUsdcUserVaultImplementationAddress,
    core.hhUser1,
  );

  const dJusdcAddress = await deployContractAndSave(
    'JonesUSDCV2IsolationModeVaultFactory',
    getJonesUSDCIsolationModeVaultFactoryConstructorParams(
      core,
      jUsdcRegistryProxy,
      core.jonesEcosystem.jUSDCV2,
      jUsdcUserVaultImplementation,
    ),
    'JonesUSDCV2IsolationModeVaultFactory',
  );
  const dJusdc = JonesUSDCV2IsolationModeVaultFactory__factory.connect(dJusdcAddress, core.hhUser1);

  const jUsdcOracleAddress = await deployContractAndSave(
    'JonesUSDCWithChainlinkAutomationPriceOracle',
    getJonesUSDCWithChainlinkAutomationPriceOracleConstructorParams(core, jUsdcRegistryProxy, dJusdc),
    'JonesUSDCV2WithChainlinkAutomationPriceOracleV1',
  );
  const jUsdcOracle = JonesUSDCWithChainlinkAutomationPriceOracle__factory.connect(jUsdcOracleAddress, core.hhUser1);

  const unwrapperAddress = await deployContractAndSave(
    'JonesUSDCIsolationModeUnwrapperTraderV2',
    getJonesUSDCIsolationModeUnwrapperTraderV2ForZapConstructorParams(core, jUsdcRegistryProxy, dJusdc),
    'JonesUSDCV2IsolationModeUnwrapperTraderV2',
  );
  const unwrapper = JonesUSDCIsolationModeUnwrapperTraderV2__factory.connect(
    unwrapperAddress,
    core.hhUser1,
  );

  const wrapperAddress = await deployContractAndSave(
    'JonesUSDCIsolationModeWrapperTraderV2',
    getJonesUSDCIsolationModeWrapperTraderV2ConstructorParams(core, jUsdcRegistryProxy, dJusdc),
    'JonesUSDCV2IsolationModeWrapperTraderV2',
  );
  const wrapper = JonesUSDCIsolationModeWrapperTraderV2__factory.connect(
    wrapperAddress,
    core.hhUser1,
  );

  const unwrapperForLiquidationAddress = await deployContractAndSave(
    'JonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation',
    getJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidationConstructorParams(core, jUsdcRegistryProxy, dJusdc),
    'JonesUSDCV2IsolationModeUnwrapperTraderV2ForLiquidation',
  );
  const unwrapperForLiquidation = JonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation__factory.connect(
    unwrapperForLiquidationAddress,
    core.hhUser1,
  );

  const isolationModeTokenVaultMigratorV1Address = await deployContractAndSave(
    'JonesIsolationModeTokenVaultMigrator',
    [
      core.jonesEcosystem.live.jonesUSDCV1Registry.address,
      core.dolomiteRegistry.address,
      core.jonesEcosystem!.jUSDCV1.address,
    ],
    'JonesIsolationModeTokenVaultMigratorV1',
  );

  const transformerAddress = await deployContractAndSave(
    'JonesUSDCTransformer',
    [core.jonesEcosystem.jUSDCV1.address, core.jonesEcosystem.jUSDCV2.address, core.jonesEcosystem.router.address],
    'JonesUSDCTransformerV1',
  );

  await jUsdcRegistryProxy.initializeUnwrapperTraders(unwrapperForLiquidation.address, unwrapper.address);

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: dJusdcOld },
      'factory',
      'ownerSetUserVaultImplementation',
      [isolationModeTokenVaultMigratorV1Address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomite: core.dolomiteMargin },
      'dolomite',
      'ownerSetMaxWei',
      [core.marketIds.djUsdcV1, ONE_BI],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregator: core.oracleAggregatorV2 },
      'oracleAggregator',
      'ownerInsertOrUpdateToken',
      [
        {
          token: dJusdc.address,
          decimals: await dJusdc.decimals(),
          oracleInfos: [
            {
              oracle: jUsdcOracle.address,
              tokenPair: core.tokens.nativeUsdc.address,
              weight: 100,
            },
          ],
        },
      ],
    ),
    ...await prettyPrintEncodeAddIsolationModeMarket(
      core,
      dJusdc,
      core.oracleAggregatorV2,
      unwrapper,
      wrapper,
      core.marketIds.djUsdcV2,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      parseEther('250000'),
      {
        additionalConverters: [unwrapperForLiquidation],
        skipAmountValidation: true,
      },
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { migrator: core.dolomiteMigrator },
      'migrator',
      'ownerSetTransformer',
      [
        core.marketIds.djUsdcV1,
        core.marketIds.djUsdcV2,
        transformerAddress,
        false,
      ],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: dJusdcOld },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [core.dolomiteMigrator.address, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: dJusdc },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [core.dolomiteMigrator.address, true],
    ),
  ];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    skipTimeDelay: true,
    invariants: async () => {
      assertHardhatInvariant(
        await core.dolomiteRegistry.dolomiteMigrator() === core.dolomiteMigrator.address,
        'dolomiteMigrator must be set on Dolomite Registry',
      );

      assertHardhatInvariant(
        await dJusdc.decimals() === 18,
        'Invalid decimals',
      );

      const transformerStruct = await core.dolomiteMigrator.getTransformerByMarketIds(
        core.marketIds.djUsdcV1,
        core.marketIds.djUsdcV2,
      );
      assertHardhatInvariant(
        !transformerStruct.soloAllowable,
        'jUSDC transformer must not be solo-able',
      );
      assertHardhatInvariant(
        transformerStruct.transformer === transformerAddress,
        'jUSDC transformer does not match',
      );

      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketMaxWei(core.marketIds.djUsdcV1)).value.eq(ONE_BI),
        'jUSDC (MAR 2024) supply cap must equal 1 unit',
      );

      assertHardhatInvariant(
        await dJusdcOld.isTokenConverterTrusted(core.dolomiteMigrator.address),
        'dolomiteMigrator must be trusted for jUSDC (OLD)',
      );

      assertHardhatInvariant(
        await dJusdc.isTokenConverterTrusted(core.dolomiteMigrator.address),
        'dolomiteMigrator must be trusted for jUSDC',
      );

      assertHardhatInvariant(
        await dJusdcOld.userVaultImplementation()
        === isolationModeTokenVaultMigratorV1Address,
        'isolationModeTokenVaultMigratorV1 must be set on jUSDC (OLD) factory',
      );

      const handler = await impersonate(handlerAddress);
      const integrationAccounts = [{ owner: '0x5C851Fd710B83705BE1cabf9D6CBd41F3544be0E', number: 0 }];
      const accountOwner = await dJusdcOld.getAccountByVault(integrationAccounts[0].owner);
      await dJusdc.createVault(accountOwner);
      const jUsdcVaultAddress = await dJusdc.getVaultByAccount(accountOwner);

      const jUsdcOldAmountWeiBefore = (await core.dolomiteMargin.getAccountWei(
        integrationAccounts[0],
        core.marketIds.djUsdcV1,
      )).value;
      const jUsdcNewAmountWeiBefore = (await core.dolomiteMargin.getAccountWei(
        { owner: jUsdcVaultAddress, number: integrationAccounts[0].number },
        core.marketIds.djUsdcV2,
      )).value;
      console.log('\tjUSDC (OLD) balance before:', jUsdcOldAmountWeiBefore.toString());
      console.log('\tjUSDC (NEW) balance before:', jUsdcNewAmountWeiBefore.toString());

      await initializeNewJUsdc(core);

      console.log('\tjUSDC (NEW) decimals:', await core.jonesEcosystem.jUSDCV2.decimals());

      await core.dolomiteMigrator.connect(handler).migrate(
        integrationAccounts,
        core.marketIds.djUsdcV1,
        core.marketIds.djUsdcV2,
        BYTES_EMPTY,
      );

      const jUsdcOldAmountWeiAfter = (await core.dolomiteMargin.getAccountWei(
        integrationAccounts[0],
        core.marketIds.djUsdcV1,
      )).value;
      const jUsdcNewAmountWeiAfter = (await core.dolomiteMargin.getAccountWei(
        { owner: jUsdcVaultAddress, number: integrationAccounts[0].number },
        core.marketIds.djUsdcV2,
      )).value;
      console.log('\tjUSDC (OLD) balance after:', jUsdcOldAmountWeiAfter.toString());
      console.log('\tjUSDC (NEW) balance after:', jUsdcNewAmountWeiAfter.toString());

      await expectProtocolBalance(
        core,
        integrationAccounts[0].owner,
        integrationAccounts[0].number,
        core.marketIds.djUsdcV1,
        ZERO_BI,
      );
      await expectProtocolBalance(
        core,
        jUsdcVaultAddress,
        integrationAccounts[0].number,
        core.marketIds.djUsdcV2,
        jUsdcOldAmountWeiBefore.add(jUsdcNewAmountWeiBefore),
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
