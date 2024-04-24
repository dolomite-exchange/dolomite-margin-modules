import CoreDeployments from '@dolomite-exchange/dolomite-margin/dist/migrations/deployed.json';
import {
  DolomiteRegistryImplementation__factory,
  EventEmitterRegistry__factory,
  IDolomiteMargin__factory,
  IDolomiteMarginV2__factory, IDolomiteRegistry, IDolomiteRegistry__factory,
  IERC20__factory,
  IERC20Metadata__factory,
} from '@dolomite-exchange/modules-base/src/types';
import {
  CHAINLINK_PRICE_AGGREGATORS_MAP,
  SLIPPAGE_TOLERANCE_FOR_PAUSE_SENTINEL,
} from '@dolomite-exchange/modules-base/src/utils/constants';
import {
  getDolomiteMigratorConstructorParams,
  getRegistryProxyConstructorParams,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAnyNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, NetworkType } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber, resetForkIfPossible } from '@dolomite-exchange/modules-base/test/utils';
import { DolomiteMargin } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  getLinearStepFunctionInterestSetterConstructorParams,
} from '@dolomite-exchange/modules-interest-setters/src/interest-setters-constructors';
import { TokenInfo } from '@dolomite-exchange/modules-oracles/src';
import {
  getChainlinkPriceOracleV3ConstructorParams,
} from '@dolomite-exchange/modules-oracles/src/oracles-constructors';
import {
  IChainlinkAggregator__factory,
  OracleAggregatorV2,
  OracleAggregatorV2__factory,
} from '@dolomite-exchange/modules-oracles/src/types';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../utils/dry-run-utils';
import getScriptName from '../../utils/get-script-name';

const handlerAddress = '0xdF86dFdf493bCD2b838a44726A1E58f66869ccBe'; // Level Initiator

async function deployInterestSetters(): Promise<void> {
  const NINETY_PERCENT = parseEther('0.90');
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(
      parseEther('0.06'),
      parseEther('0.94'),
      NINETY_PERCENT,
    ),
    'Stablecoin6L94ULinearStepFunctionInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(
      parseEther('0.08'),
      parseEther('0.92'),
      NINETY_PERCENT,
    ),
    'Stablecoin8L92ULinearStepFunctionInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(
      parseEther('0.10'),
      parseEther('0.90'),
      parseEther('0.95'),
    ),
    'Stablecoin10L90U95OLinearStepFunctionInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(
      parseEther('0.14'),
      parseEther('0.86'),
      NINETY_PERCENT,
    ),
    'Altcoin14L86ULinearStepFunctionInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(
      parseEther('0.16'),
      parseEther('0.84'),
      NINETY_PERCENT,
    ),
    'Altcoin16L84ULinearStepFunctionInterestSetter',
  );
}

async function getOracleAggregator<T extends NetworkType>(
  network: T,
  dolomiteRegistry: IDolomiteRegistry,
  dolomiteMargin: DolomiteMargin<T>,
): Promise<OracleAggregatorV2> {
  const tokens = Object.keys(CHAINLINK_PRICE_AGGREGATORS_MAP[network])
    .map(t => IERC20__factory.connect(t, dolomiteMargin.signer));

  const aggregators = tokens.map(t => IChainlinkAggregator__factory.connect(
    CHAINLINK_PRICE_AGGREGATORS_MAP[network][t.address].aggregatorAddress,
    dolomiteMargin.signer,
  ));
  const decimals = await Promise.all(tokens.map(t => IERC20Metadata__factory.connect(t.address, t.signer).decimals()));
  const tokenPairs = tokens.map(t =>
    IERC20__factory.connect(
      CHAINLINK_PRICE_AGGREGATORS_MAP[network][t.address].tokenPairAddress ?? ADDRESS_ZERO,
      dolomiteMargin.signer,
    ),
  );
  const invertPrices = tokens.map(() => false);
  const chainlinkPriceOracleAddress = await deployContractAndSave(
    'ChainlinkPriceOracleV3',
    getChainlinkPriceOracleV3ConstructorParams<T>(
      tokens,
      aggregators,
      invertPrices,
      dolomiteRegistry,
      dolomiteMargin,
    ),
    'ChainlinkPriceOracleV3',
  );

  const tokenInfos = tokens.map<TokenInfo>((token, i) => {
    return {
      token: token.address,
      decimals: decimals[i],
      oracleInfos: [
        {
          oracle: chainlinkPriceOracleAddress,
          weight: 100,
          tokenPair: tokenPairs[i].address,
        },
      ],
    };
  });
  const oracleAggregatorAddress = await deployContractAndSave(
    'OracleAggregatorV2',
    [tokenInfos as any[], dolomiteMargin.address],
    'OracleAggregatorV2',
  );
  return OracleAggregatorV2__factory.connect(oracleAggregatorAddress, dolomiteMargin.signer);
}

async function main<T extends NetworkType>(): Promise<DryRunOutput<T>> {
  const network = await getAnyNetwork() as T;
  await resetForkIfPossible(await getRealLatestBlockNumber(true, network), network);
  const [hhUser1] = await ethers.getSigners();
  const transactions: EncodedTransaction[] = [];

  let dolomiteMargin: DolomiteMargin<T>;
  if (network === Network.ArbitrumOne) {
    dolomiteMargin = IDolomiteMargin__factory.connect(
      CoreDeployments.DolomiteMargin[network].address,
      hhUser1,
    ) as DolomiteMargin<T>;
  } else {
    dolomiteMargin = IDolomiteMarginV2__factory.connect(
      CoreDeployments.DolomiteMargin[network].address,
      hhUser1,
    ) as DolomiteMargin<T>;
  }

  const eventEmitterRegistryImplementationAddress = await deployContractAndSave(
    'EventEmitterRegistry',
    [],
    'EventEmitterRegistryImplementationV2',
  );
  const eventEmitterRegistry = EventEmitterRegistry__factory.connect(
    eventEmitterRegistryImplementationAddress,
    hhUser1,
  );
  const eventEmitterRegistryCalldata = await eventEmitterRegistry.populateTransaction.initialize();
  const eventEmitterAddress = await deployContractAndSave(
    'RegistryProxy',
    getRegistryProxyConstructorParams(
      eventEmitterRegistryImplementationAddress,
      eventEmitterRegistryCalldata.data!,
      dolomiteMargin,
    ),
    'EventEmitterRegistryProxy',
  );

  const registryImplementationAddress = await deployContractAndSave(
    'DolomiteRegistryImplementation',
    [],
    'DolomiteRegistryImplementationV7',
  );
  const registryImplementation = DolomiteRegistryImplementation__factory.connect(
    registryImplementationAddress,
    hhUser1,
  );
  const registryImplementationCalldata = await registryImplementation.populateTransaction.initialize(
    CoreDeployments.GenericTraderProxyV1[network].address,
    CoreDeployments.Expiry[network].address,
    SLIPPAGE_TOLERANCE_FOR_PAUSE_SENTINEL,
    CoreDeployments.LiquidatorAssetRegistry[network].address,
    eventEmitterAddress,
  );
  const dolomiteRegistryAddress = await deployContractAndSave(
    'RegistryProxy',
    getRegistryProxyConstructorParams(
      registryImplementationAddress,
      registryImplementationCalldata.data!,
      dolomiteMargin,
    ),
    'DolomiteRegistryProxy',
  );
  const dolomiteRegistry = IDolomiteRegistry__factory.connect(dolomiteRegistryAddress, hhUser1);

  const dolomiteMigratorAddress = await deployContractAndSave(
    'DolomiteMigrator',
    getDolomiteMigratorConstructorParams(dolomiteMargin, dolomiteRegistry, handlerAddress),
    'DolomiteMigratorV1',
  );
  const oracleAggregator = await getOracleAggregator(network, dolomiteRegistry, dolomiteMargin);

  if (await dolomiteRegistry.dolomiteMigrator() !== ADDRESS_ZERO) {
    await dolomiteRegistry.lazyInitialize(dolomiteMigratorAddress, oracleAggregator.address);
  }

  await deployContractAndSave(
    'IsolationModeTokenVaultV1ActionsImpl',
    [],
    'IsolationModeTokenVaultV1ActionsImplV1',
  );

  await deployContractAndSave(
    'AsyncIsolationModeUnwrapperTraderImpl',
    [],
    'AsyncIsolationModeUnwrapperTraderImplV1',
  );

  await deployContractAndSave(
    'AsyncIsolationModeWrapperTraderImpl',
    [],
    'AsyncIsolationModeWrapperTraderImplV1',
  );

  await deployInterestSetters();

  const core = await setupCoreProtocol({
    network,
    blockNumber: 0,
    skipForking: true,
  });

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteRegistry },
      'dolomiteRegistry',
      'ownerSetDolomiteMigrator',
      [dolomiteMigratorAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteRegistry },
      'dolomiteRegistry',
      'ownerSetOracleAggregator',
      [oracleAggregator.address],
    ),
  );

  return {
    core: null as any,
    invariants: async () => {
    },
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
  };
}

// noinspection JSIgnoredPromiseFromCall
doDryRunAndCheckDeployment(main);
