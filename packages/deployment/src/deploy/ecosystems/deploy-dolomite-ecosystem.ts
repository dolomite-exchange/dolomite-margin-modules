import CoreDeployments from '@dolomite-exchange/dolomite-margin/dist/migrations/deployed.json';
import {
  DolomiteRegistryImplementation__factory,
  EventEmitterRegistry__factory,
  IDolomiteMargin__factory,
  IDolomiteMarginV2__factory,
} from '@dolomite-exchange/modules-base/src/types';
import { SLIPPAGE_TOLERANCE_FOR_PAUSE_SENTINEL } from '@dolomite-exchange/modules-base/src/utils/constants';
import { getRegistryProxyConstructorParams } from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAnyNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, NetworkType } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { DolomiteMargin } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import { ethers } from 'hardhat';
import { deployContractAndSave } from '../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../utils/dry-run-utils';
import getScriptName from '../../utils/get-script-name';

async function deployInterestSetters(): Promise<void> {
  await deployContractAndSave('LinearStepFunctionInterestSetter', []);
}

async function main<T extends NetworkType>(): Promise<DryRunOutput<T>> {
  const network = await getAnyNetwork() as T;
  const [hh1User1] = await ethers.getSigners();

  let dolomiteMargin: DolomiteMargin<T>;
  if (network === Network.ArbitrumOne) {
    dolomiteMargin = IDolomiteMargin__factory.connect(
      CoreDeployments.DolomiteMargin[network].address,
      hh1User1,
    ) as DolomiteMargin<T>;
  } else {
    dolomiteMargin = IDolomiteMarginV2__factory.connect(
      CoreDeployments.DolomiteMargin[network].address,
      hh1User1,
    ) as DolomiteMargin<T>;
  }

  const eventEmitterRegistryImplementationAddress = await deployContractAndSave(
    'EventEmitterRegistry',
    [],
    'EventEmitterRegistryImplementationV2',
  );
  const eventEmitterRegistry = EventEmitterRegistry__factory.connect(
    eventEmitterRegistryImplementationAddress,
    hh1User1,
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
    'DolomiteRegistryImplementationV6',
  );
  const registryImplementation = DolomiteRegistryImplementation__factory.connect(
    registryImplementationAddress,
    hh1User1,
  );
  const registryImplementationCalldata = await registryImplementation.populateTransaction.initialize(
    CoreDeployments.GenericTraderProxyV1[network].address,
    CoreDeployments.Expiry[network].address,
    SLIPPAGE_TOLERANCE_FOR_PAUSE_SENTINEL,
    CoreDeployments.LiquidatorAssetRegistry[network].address,
    eventEmitterAddress,
    CoreDeployments.ChainlinkPriceOracleV1[network].address,
  );
  await deployContractAndSave(
    'RegistryProxy',
    getRegistryProxyConstructorParams(
      registryImplementationAddress,
      registryImplementationCalldata.data!,
      dolomiteMargin,
    ),
    'DolomiteRegistryProxy',
  );
  await deployContractAndSave(
    'IsolationModeTokenVaultV1ActionsImpl',
    [],
    'IsolationModeTokenVaultV1ActionsImplV3',
  );

  await deployInterestSetters();

  return {
    core: null as any,
    invariants: async () => {
    },
    scriptName: getScriptName(__filename),
    upload: {
      chainId: network,
      transactions: [],
    },
  };
}

// noinspection JSIgnoredPromiseFromCall
doDryRunAndCheckDeployment(main);
