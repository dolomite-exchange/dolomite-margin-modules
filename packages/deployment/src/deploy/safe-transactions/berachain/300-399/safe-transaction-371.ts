import { parseEther } from 'ethers/lib/utils';
import { CHAINSIGHT_KEYS_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { deployContractAndSave } from 'packages/deployment/src/utils/deploy-utils';
import {
  getBerachainRewardsRegistryConstructorParams,
  getInfraredBGTIsolationModeVaultFactoryConstructorParams,
} from 'packages/berachain/src/berachain-constructors';
import {
  BerachainRewardsRegistry__factory,
  InfraredBGTIsolationModeTokenVaultV1__factory,
  InfraredBGTIsolationModeVaultFactory__factory,
  InfraredBGTMetaVault__factory,
} from 'packages/berachain/src/types';
import {
  SimpleIsolationModeUnwrapperTraderV2__factory,
  SimpleIsolationModeWrapperTraderV2__factory,
} from 'packages/base/src/types';
import { encodeAddIsolationModeMarket } from 'packages/deployment/src/utils/encoding/add-market-encoder-utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { encodeInsertChainsightOracleV3 } from 'packages/deployment/src/utils/encoding/oracle-encoder-utils';

/**
 * This script encodes the following transactions:
 * - Deploys iBGT Isolation Mode Ecosystems
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });
  const iBgtMarketId = await core.dolomiteMargin.getNumMarkets();

  const transactions: EncodedTransaction[] = [];

  // Deploy iBgt vault implementation and InfraredBGTMetaVault implementation
  const userVaultImplementationAddress = await deployContractAndSave(
    'InfraredBGTIsolationModeTokenVaultV1',
    [],
    'InfraredBGTIsolationModeTokenVaultV1',
    core.libraries.tokenVaultActionsImpl,
  );
  const userVaultImplementation = InfraredBGTIsolationModeTokenVaultV1__factory.connect(
    userVaultImplementationAddress,
    core.governance,
  );

  const infraredMetavaultImplementationAddress = await deployContractAndSave(
    'InfraredBGTMetaVault',
    [],
    'InfraredBGTMetaVaultImplementationV1',
  );
  const infraredMetavaultImplementation = InfraredBGTMetaVault__factory.connect(
    infraredMetavaultImplementationAddress,
    core.governance,
  );

  // Deploy BerachainRewardsRegistry
  const registryImplementationAddress = await deployContractAndSave(
    'BerachainRewardsRegistry',
    [],
    'BerachainRewardsRegistryImplementationV1',
  );
  const registryImplementation = BerachainRewardsRegistry__factory.connect(
    registryImplementationAddress,
    core.governance,
  );

  const registryAddress = await deployContractAndSave(
    'RegistryProxy',
    await getBerachainRewardsRegistryConstructorParams(
      registryImplementation,
      infraredMetavaultImplementation,
      core.berachainRewardsEcosystem.live.polLiquidatorProxy,
      core,
    ),
    'BerachainRewardsRegistryProxy',
  );
  const registry = BerachainRewardsRegistry__factory.connect(registryAddress, core.governance);

  // Deploy iBgt factory, wrapper, unwrapper, set up oracle, and add isolation mode market
  const ibgtFactoryAddress = await deployContractAndSave(
    'InfraredBGTIsolationModeVaultFactory',
    getInfraredBGTIsolationModeVaultFactoryConstructorParams(registry, core.tokens.iBgt, userVaultImplementation, core),
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

  // @follow-up Check this code
  transactions.push(
    ...(await encodeInsertChainsightOracleV3(
      core,
      ibgtFactory as any,
      false,
      ADDRESS_ZERO,
      CHAINSIGHT_KEYS_MAP[Network.Berachain][core.tokens.iBgt.address]!.key,
    )),
  );

  transactions.push(
    ...(await encodeAddIsolationModeMarket(
      core,
      ibgtFactory,
      core.oracleAggregatorV2,
      ibgtUnwrapper,
      ibgtWrapper,
      iBgtMarketId,
      TargetCollateralization._120, // @follow-up adjust
      TargetLiquidationPenalty._6, // adjust
      parseEther(`${2_000}`), // adjust
    )),
  );

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { berachainRewardsRegistry: registry },
      'berachainRewardsRegistry',
      'ownerSetIBgtIsolationModeVaultFactory',
      [ibgtFactory.address],
    ),
  );

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
        (await core.dolomiteMargin.getMarketTokenAddress(iBgtMarketId)) === ibgtFactory.address,
        'Invalid iBgt market ID',
      );
      assertHardhatInvariant(
        (await registry.iBgtIsolationModeVaultFactory()) === ibgtFactory.address,
        'Invalid iBgt isolation mode vault factory',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
