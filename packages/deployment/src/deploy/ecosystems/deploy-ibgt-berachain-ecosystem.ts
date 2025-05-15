import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import {
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeUnwrapperTraderV2__factory,
  SimpleIsolationModeWrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2__factory,
} from 'packages/base/src/types';
import {
  getUpgradeableProxyConstructorParams,
  TargetCollateralization,
  TargetLiquidationPenalty,
} from 'packages/base/src/utils/constructors/dolomite';
import { getAnyNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network, ONE_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber, setEtherBalance } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  getBerachainRewardsRegistryConstructorParams,
  getInfraredBGTIsolationModeVaultFactoryConstructorParams,
} from 'packages/berachain/src/berachain-constructors';
import {
  BerachainRewardsRegistry__factory,
  InfraredBGTIsolationModeTokenVaultV1__factory,
  InfraredBGTIsolationModeVaultFactory__factory,
  POLLiquidatorProxyV1,
  POLLiquidatorProxyV1__factory,
} from 'packages/berachain/src/types';
import { deployContractAndSave } from '../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../utils/dry-run-utils';
import { encodeAddIsolationModeMarket, encodeAddMarket } from '../../utils/encoding/add-market-encoder-utils';
import getScriptName from '../../utils/get-script-name';
import { printPriceForVisualCheck } from '../../utils/invariant-utils';

type AcceptableNetworks = Network.Berachain;

/**
 * This script encodes the following transactions:
 * - Deploys the meta-vault implementation and berachain rewards registry
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

  const polLiquidatorImplementationAddress = await deployContractAndSave(
    'POLLiquidatorProxyV1',
    [core.liquidatorProxyV6.address, core.dolomiteMargin.address],
    'POLLiquidatorProxyImplementationV1',
  );
  const polLiquidatorImplementation = POLLiquidatorProxyV1__factory.connect(
    polLiquidatorImplementationAddress,
    core.hhUser1,
  );
  const polLiquidatorProxyAddress = await deployContractAndSave(
    'RegistryProxy',
    getUpgradeableProxyConstructorParams(
      polLiquidatorImplementationAddress,
      await polLiquidatorImplementation.populateTransaction.initialize(),
      core.dolomiteMargin,
    ),
    'PolLiquidatorProxy',
  );
  const polLiquidatorProxy = POLLiquidatorProxyV1__factory.connect(polLiquidatorProxyAddress, core.hhUser1);

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
      polLiquidatorProxy,
      core,
    ),
    'BerachainRewardsRegistryProxy',
  );
  const berachainRewardsRegistry = BerachainRewardsRegistry__factory.connect(
    berachainRegistryProxyAddress,
    core.hhUser1,
  );

  const transactions: EncodedTransaction[] = [];
  const iBgtPlaceholderMarketId = await core.dolomiteMargin.getNumMarkets();
  const iBgtMarketId = iBgtPlaceholderMarketId.add(1);

  /*
   * Deploy iBGT isolation mode market
   */
  const iBgtVaultImplementationAddress = await deployContractAndSave(
    'InfraredBGTIsolationModeTokenVaultV1',
    [],
    'InfraredBGTIsolationModeTokenVaultV1',
    { ...core.libraries.tokenVaultActionsImpl },
  );
  const iBgtVaultImplementation = InfraredBGTIsolationModeTokenVaultV1__factory.connect(
    iBgtVaultImplementationAddress,
    core.hhUser1,
  );

  const iBgtFactoryAddress = await deployContractAndSave(
    'InfraredBGTIsolationModeVaultFactory',
    getInfraredBGTIsolationModeVaultFactoryConstructorParams(
      berachainRewardsRegistry,
      core.tokens.iBgt,
      iBgtVaultImplementation,
      core,
    ),
    'InfraredBGTIsolationModeVaultFactory',
  );
  const iBgtFactory = InfraredBGTIsolationModeVaultFactory__factory.connect(iBgtFactoryAddress, core.hhUser1);

  const iBgtUnwrapperAddress = await deployContractAndSave(
    'SimpleIsolationModeUnwrapperTraderV2',
    [iBgtFactory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address],
    'InfraredBGTIsolationModeUnwrapperTraderV2',
  );
  const iBgtUnwrapper = SimpleIsolationModeUnwrapperTraderV2__factory.connect(iBgtUnwrapperAddress, core.hhUser1);

  const iBgtWrapperAddress = await deployContractAndSave(
    'SimpleIsolationModeWrapperTraderV2',
    [iBgtFactory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address],
    'InfraredBGTIsolationModeWrapperTraderV2',
  );
  const iBgtWrapper = SimpleIsolationModeWrapperTraderV2__factory.connect(iBgtWrapperAddress, core.hhUser1);

  transactions.push(
    ...(await encodeAddMarket(
      core,
      core.tokens.iBgt,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      ONE_BI,
      ZERO_BI,
      true,
    )),
  );
  transactions.push(
    ...(await encodeAddIsolationModeMarket(
      core,
      iBgtFactory,
      core.oracleAggregatorV2,
      iBgtUnwrapper,
      iBgtWrapper,
      iBgtMarketId,
      TargetCollateralization._125,
      TargetLiquidationPenalty._6,
      parseEther(`${50_000}`),
    )),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
    },
    invariants: async () => {
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketIdByTokenAddress(iBgtFactory.address)) === iBgtMarketId,
        'iBGT market id is incorrect',
      );

      assertHardhatInvariant(
        (await iBgtFactory.UNDERLYING_TOKEN()) === core.tokens.iBgt.address,
        'iBGT factory underlying token is incorrect',
      );

      assertHardhatInvariant(
        await iBgtFactory.isTokenConverterTrusted(iBgtUnwrapper.address),
        'iBGT unwrapper is not trusted',
      );
      assertHardhatInvariant(
        await iBgtFactory.isTokenConverterTrusted(iBgtWrapper.address),
        'iBGT wrapper is not trusted',
      );

      await printPriceForVisualCheck(core, iBgtFactory);
    },
  };
}

doDryRunAndCheckDeployment(main);
