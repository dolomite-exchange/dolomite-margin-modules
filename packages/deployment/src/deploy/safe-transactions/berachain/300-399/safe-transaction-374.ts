import { CHAINSIGHT_KEYS_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
import {
  AccountRiskOverrideCategory,
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import {
  SimpleIsolationModeUnwrapperTraderV2__factory,
  SimpleIsolationModeWrapperTraderV2__factory,
} from 'packages/base/src/types';
import {
  getInfraredBGTIsolationModeVaultFactoryConstructorParams,
} from 'packages/berachain/src/berachain-constructors';
import {
  InfraredBGTIsolationModeTokenVaultV1__factory,
  InfraredBGTIsolationModeVaultFactory__factory,
} from 'packages/berachain/src/types';
import { deployContractAndSave } from 'packages/deployment/src/utils/deploy-utils';
import { encodeAddIsolationModeMarket } from 'packages/deployment/src/utils/encoding/add-market-encoder-utils';
import { encodeInsertChainsightOracleV3 } from 'packages/deployment/src/utils/encoding/oracle-encoder-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import {
  encodeSetAccountRiskOverrideCategoryByMarketId,
  encodeSetAccountRiskOverrideCategorySettings,
  encodeSetMinCollateralization,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  checkLiquidationPenalty,
  checkMinCollateralization,
  printPriceForVisualCheck,
} from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Deploys staked iBGT isolation mode token
 * - Deploys the iBGT Isolation Mode Ecosystems
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  // Deploy iBgt vault implementation and InfraredBGTMetaVault implementation
  const ibgtImplementationAddress = await deployContractAndSave(
    'InfraredBGTIsolationModeTokenVaultV1',
    [],
    'InfraredBGTIsolationModeTokenVaultV1',
    core.libraries.tokenVaultActionsImpl,
  );
  const ibgtImplementation = InfraredBGTIsolationModeTokenVaultV1__factory.connect(
    ibgtImplementationAddress,
    core.governance,
  );

  const berachainRewardsRegistry = core.berachainRewardsEcosystem.live.registry;

  // Deploy iBgt factory, wrapper, unwrapper, set up oracle, and add isolation mode market
  const ibgtFactoryAddress = await deployContractAndSave(
    'InfraredBGTIsolationModeVaultFactory',
    getInfraredBGTIsolationModeVaultFactoryConstructorParams(
      berachainRewardsRegistry,
      core.tokens.iBgt,
      ibgtImplementation,
      core,
    ),
    'InfraredBGTIsolationModeVaultFactory',
  );
  const ibgtFactory = InfraredBGTIsolationModeVaultFactory__factory.connect(ibgtFactoryAddress, core.governance);

  // deploy iBgt wrapper/unwrapper
  const ibgtWrapperAddress = await deployContractAndSave(
    'SimpleIsolationModeWrapperTraderV2',
    [ibgtFactory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address],
    'InfraredBGTIsolationModeWrapperTraderV2',
  );
  const ibgtWrapper = SimpleIsolationModeWrapperTraderV2__factory.connect(ibgtWrapperAddress, core.governance);

  const ibgtUnwrapperAddress = await deployContractAndSave(
    'SimpleIsolationModeUnwrapperTraderV2',
    [ibgtFactory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address],
    'InfraredBGTIsolationModeUnwrapperTraderV2',
  );
  const ibgtUnwrapper = SimpleIsolationModeUnwrapperTraderV2__factory.connect(ibgtUnwrapperAddress, core.governance);

  const transactions: EncodedTransaction[] = [
    ...(await encodeInsertChainsightOracleV3(core, core.tokens.iBgt)),
    ...(await encodeInsertChainsightOracleV3(
      core,
      ibgtFactory,
      CHAINSIGHT_KEYS_MAP[Network.Berachain][core.tokens.iBgt.address]!.invertPrice,
      CHAINSIGHT_KEYS_MAP[Network.Berachain][core.tokens.iBgt.address]!.tokenPairAddress,
      CHAINSIGHT_KEYS_MAP[Network.Berachain][core.tokens.iBgt.address]!.key,
    )),
    ...(await encodeAddIsolationModeMarket(
      core,
      ibgtFactory,
      core.oracleAggregatorV2,
      ibgtUnwrapper,
      ibgtWrapper,
      core.marketIds.diBgt,
      TargetCollateralization._150,
      TargetLiquidationPenalty._15,
      parseEther(`${3_000_000}`),
    )),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { berachainRewardsRegistry },
      'berachainRewardsRegistry',
      'ownerSetIBgtIsolationModeVaultFactory',
      [ibgtFactory.address],
    ),
    await encodeSetMinCollateralization(core, core.marketIds.wbera, TargetCollateralization._142),
    await encodeSetAccountRiskOverrideCategorySettings(
      core,
      AccountRiskOverrideCategory.BERA,
      TargetCollateralization._133,
      TargetLiquidationPenalty._10,
    ),
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, core.marketIds.diBgt, AccountRiskOverrideCategory.BERA),
  ];

  return {
    core,
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: core.network,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    scriptName: getScriptName(__filename),
    invariants: async () => {
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.diBgt)) === ibgtFactory.address,
        'Invalid iBgt market ID',
      );
      assertHardhatInvariant(
        (await berachainRewardsRegistry.iBgtIsolationModeVaultFactory()) === ibgtFactory.address,
        'Invalid iBgt isolation mode vault factory',
      );
      await checkMinCollateralization(core, core.marketIds.diBgt, TargetCollateralization._150);
      await checkLiquidationPenalty(core, core.marketIds.diBgt, TargetLiquidationPenalty._15);
      await checkMinCollateralization(core, core.marketIds.wbera, TargetCollateralization._142);
      await printPriceForVisualCheck(core, core.tokens.iBgt);
      await printPriceForVisualCheck(core, ibgtFactory);
    },
  };
}

doDryRunAndCheckDeployment(main);
