import { getAnyNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network, ONE_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber, setEtherBalance } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { deployContractAndSave, EncodedTransaction, prettyPrintEncodeAddIsolationModeMarket, prettyPrintEncodeAddMarket } from '../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../utils/dry-run-utils';
import getScriptName from '../../utils/get-script-name';
import {
  getBerachainRewardsRegistryConstructorParams,
  getBGTIsolationModeUnwrapperTraderV2ConstructorParams,
  getBGTIsolationModeVaultFactoryConstructorParams,
  getBGTMIsolationModeUnwrapperTraderV2ConstructorParams,
  getBGTMIsolationModeVaultFactoryConstructorParams,
  getInfraredBGTIsolationModeVaultFactoryConstructorParams
} from 'packages/berachain/src/berachain-constructors';
import {
  BerachainRewardsRegistry__factory,
  BGTIsolationModeTokenVaultV1__factory,
  BGTIsolationModeUnwrapperTraderV2__factory,
  BGTIsolationModeVaultFactory__factory,
  BGTMERC20Wrapper__factory,
  BGTMIsolationModeTokenVaultV1__factory,
  BGTMIsolationModeUnwrapperTraderV2__factory,
  BGTMIsolationModeVaultFactory__factory,
  InfraredBGTIsolationModeTokenVaultV1__factory,
  InfraredBGTIsolationModeVaultFactory__factory
} from 'packages/berachain/src/types';
import { TargetCollateralization, TargetLiquidationPenalty } from 'packages/base/src/utils/constructors/dolomite';
import { parseEther } from 'ethers/lib/utils';
import { SimpleIsolationModeUnwrapperTraderV2__factory, SimpleIsolationModeWrapperTraderV2__factory } from 'packages/base/src/types';

type AcceptableNetworks = Network.Berachain;

/**
 * This script encodes the following transactions:
 * - Deploys the metavault implementation and berachain rewards registry
 * - Deploys the BGTM wrapper token
 * - Deploys the isolation mode markets for bgt, bgtm, and iBgt
 */
async function main(): Promise<DryRunOutput<AcceptableNetworks>> {
  const rawNetwork = await getAnyNetwork();
  if (rawNetwork !== Network.Berachain) {
    return Promise.reject(new Error(`Invalid network: ${rawNetwork}`));
  }
  const network = rawNetwork as AcceptableNetworks;
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });
  await setEtherBalance(core.gnosisSafe.address, parseEther('1000'));

  /*
   * Deploy metavault implementation and berachain rewards registry
   */
  const metaVaultImplementationAddress = await deployContractAndSave(
    'BerachainRewardsMetaVault',
    [],
    'BerachainRewardsMetaVaultV1',
  );
  const berachainRegistryImplementationAddress = await deployContractAndSave(
    'BerachainRewardsRegistry',
    [],
    'BerachainRewardsRegistryImplementationV1',
  );
  const berachainRegistryImplementation = BerachainRewardsRegistry__factory.connect(
    berachainRegistryImplementationAddress,
    core.hhUser1,
  );
  const berachainRegistryProxyAddress = await deployContractAndSave(
    'RegistryProxy',
    await getBerachainRewardsRegistryConstructorParams(
      berachainRegistryImplementation,
      { address: metaVaultImplementationAddress } as any,
      core
    ),
    'BerachainRewardsRegistryProxy',
  );
  const berachainRewardsRegistry = BerachainRewardsRegistry__factory.connect(berachainRegistryProxyAddress, core.hhUser1);

  const bgtmWrapperAddress = await deployContractAndSave(
    'BGTMERC20Wrapper',
    [core.berachainRewardsEcosystem.bgtm.address],
    'BGTMERC20WrapperV1',
  );
  const bgtmWrapper = BGTMERC20Wrapper__factory.connect(bgtmWrapperAddress, core.hhUser1);

  const transactions: EncodedTransaction[] = [];
  const bgtMarketId = await core.dolomiteMargin.getNumMarkets();
  const bgtmMarketId = bgtMarketId.add(1);
  const ibgtPlaceholderMarketId = bgtmMarketId.add(1);
  const ibgtMarketId = ibgtPlaceholderMarketId.add(1);

  /*
   * Deploy BGT isolation mode market
   */
  const bgtVaultImplementationAddress = await deployContractAndSave(
    'BGTIsolationModeTokenVaultV1',
    [],
    'BGTIsolationModeTokenVaultV1',
    { ...core.libraries.tokenVaultActionsImpl}
  );
  const bgtVaultImplementation = BGTIsolationModeTokenVaultV1__factory.connect(bgtVaultImplementationAddress, core.hhUser1);

  const bgtFactoryAddress = await deployContractAndSave(
    'BGTIsolationModeVaultFactory',
    getBGTIsolationModeVaultFactoryConstructorParams(berachainRewardsRegistry, core.tokens.bgt, bgtVaultImplementation, core),
    'BGTIsolationModeVaultFactory',
  );
  const bgtFactory = BGTIsolationModeVaultFactory__factory.connect(bgtFactoryAddress, core.hhUser1);

  const bgtUnwrapperAddress = await deployContractAndSave(
    'BGTIsolationModeUnwrapperTraderV2',
    getBGTIsolationModeUnwrapperTraderV2ConstructorParams(berachainRewardsRegistry, bgtFactory, core),
    'BGTIsolationModeUnwrapperTraderV2',
  );
  const bgtUnwrapper = BGTIsolationModeUnwrapperTraderV2__factory.connect(bgtUnwrapperAddress, core.hhUser1);

  throw new Error(
    'Update with proper oracles, appropriate collat, liquidation penalty, max supply, and what to do with wrapper parameter'
  );
  transactions.push(
    ...await prettyPrintEncodeAddIsolationModeMarket(
      core,
      bgtFactory,
      core.oracleAggregatorV2,
      bgtUnwrapper,
      bgtUnwrapper as any,
      bgtMarketId,
      TargetCollateralization._125,
      TargetLiquidationPenalty._6,
      parseEther(`${15_000_000}`),
    )
  );

  /*
   * Deploy BGTM isolation mode market
   */
  const bgtmVaultImplementationAddress = await deployContractAndSave(
    'BGTMIsolationModeTokenVaultV1',
    [],
    'BGTMsolationModeTokenVaultV1',
    { ...core.libraries.tokenVaultActionsImpl}
  );
  const bgtmVaultImplementation = BGTMIsolationModeTokenVaultV1__factory.connect(bgtmVaultImplementationAddress, core.hhUser1);

  const bgtmFactoryAddress = await deployContractAndSave(
    'BGTMIsolationModeVaultFactory',
    getBGTMIsolationModeVaultFactoryConstructorParams(berachainRewardsRegistry, bgtmWrapper, bgtmVaultImplementation, core),
    'BGTMIsolationModeVaultFactory',
  );
  const bgtmFactory = BGTMIsolationModeVaultFactory__factory.connect(bgtmFactoryAddress, core.hhUser1);

  const bgtmUnwrapperAddress = await deployContractAndSave(
    'BGTMIsolationModeUnwrapperTraderV2',
    getBGTMIsolationModeUnwrapperTraderV2ConstructorParams(berachainRewardsRegistry, bgtmFactory, core),
    'BGTMIsolationModeUnwrapperTraderV2',
  );
  const bgtmUnwrapper = BGTMIsolationModeUnwrapperTraderV2__factory.connect(bgtmUnwrapperAddress, core.hhUser1);

  transactions.push(
    ...await prettyPrintEncodeAddIsolationModeMarket(
      core,
      bgtmFactory,
      core.oracleAggregatorV2,
      bgtmUnwrapper,
      bgtmUnwrapper as any,
      bgtmMarketId,
      TargetCollateralization._125,
      TargetLiquidationPenalty._6,
      parseEther(`${15_000_000}`),
    )
  );

  /*
   * Deploy BGTM isolation mode market
   */
  const ibgtVaultImplementationAddress = await deployContractAndSave(
    'InfraredBGTIsolationModeTokenVaultV1',
    [],
    'InfraredBGTIsolationModeTokenVaultV1',
    { ...core.libraries.tokenVaultActionsImpl}
  );
  const ibgtVaultImplementation = InfraredBGTIsolationModeTokenVaultV1__factory.connect(ibgtVaultImplementationAddress, core.hhUser1);

  const ibgtFactoryAddress = await deployContractAndSave(
    'InfraredBGTIsolationModeVaultFactory',
    getInfraredBGTIsolationModeVaultFactoryConstructorParams(berachainRewardsRegistry, core.tokens.iBgt, ibgtVaultImplementation, core),
    'InfraredBGTIsolationModeVaultFactory',
  );
  const ibgtFactory = InfraredBGTIsolationModeVaultFactory__factory.connect(ibgtFactoryAddress, core.hhUser1);

  const ibgtUnwrapperAddress = await deployContractAndSave(
    'SimpleIsolationModeUnwrapperTraderV2',
    [ibgtFactory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address],
    'InfraredBGTIsolationModeUnwrapperTraderV2',
  );
  const ibgtUnwrapper = SimpleIsolationModeUnwrapperTraderV2__factory.connect(ibgtUnwrapperAddress, core.hhUser1);

  const ibgtWrapperAddress = await deployContractAndSave(
    'SimpleIsolationModeWrapperTraderV2',
    [ibgtFactory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address],
    'InfraredBGTIsolationModeWrapperTraderV2',
  );
  const ibgtWrapper = SimpleIsolationModeWrapperTraderV2__factory.connect(ibgtWrapperAddress, core.hhUser1);

  transactions.push(
    ...await prettyPrintEncodeAddMarket(
      core,
      core.tokens.iBgt,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization._120,
      TargetLiquidationPenalty._15,
      ONE_BI,
      ZERO_BI,
      true
    )
  );
  transactions.push(
    ...await prettyPrintEncodeAddIsolationModeMarket(
      core,
      ibgtFactory,
      core.oracleAggregatorV2,
      ibgtUnwrapper,
      ibgtWrapper,
      ibgtMarketId,
      TargetCollateralization._125,
      TargetLiquidationPenalty._6,
      parseEther(`${15_000_000}`),
    )
  );


  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
    },
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);
