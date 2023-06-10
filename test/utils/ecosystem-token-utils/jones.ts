import { address } from '@dolomite-exchange/dolomite-margin';
import {
  IJonesUSDCIsolationModeTokenVaultV1,
  IJonesUSDCRegistry,
  JonesUSDCIsolationModeTokenVaultV1,
  JonesUSDCIsolationModeTokenVaultV1__factory,
  JonesUSDCIsolationModeUnwrapperTraderV2,
  JonesUSDCIsolationModeUnwrapperTraderV2__factory,
  JonesUSDCIsolationModeVaultFactory,
  JonesUSDCIsolationModeVaultFactory__factory,
  JonesUSDCIsolationModeWrapperTraderV2,
  JonesUSDCIsolationModeWrapperTraderV2__factory,
  JonesUSDCPriceOracle,
  JonesUSDCPriceOracle__factory,
  JonesUSDCRegistry,
  JonesUSDCRegistry__factory,
} from '../../../src/types';
import {
  getJonesUSDCIsolationModeUnwrapperTraderV2ConstructorParams,
  getJonesUSDCIsolationModeVaultFactoryConstructorParams,
  getJonesUSDCIsolationModeWrapperTraderV2ConstructorParams,
  getJonesUSDCPriceOracleConstructorParams,
  getJonesUSDCRegistryConstructorParams,
} from '../../../src/utils/constructors/jones';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { CoreProtocol } from '../setup';

export function createJonesUSDCIsolationModeVaultFactory(
  core: CoreProtocol,
  jonesUSDCRegistry: IJonesUSDCRegistry | JonesUSDCRegistry,
  jUSDCToken: { address: address },
  userVaultImplementation: IJonesUSDCIsolationModeTokenVaultV1 | JonesUSDCIsolationModeTokenVaultV1,
): Promise<JonesUSDCIsolationModeVaultFactory> {
  return createContractWithAbi<JonesUSDCIsolationModeVaultFactory>(
    JonesUSDCIsolationModeVaultFactory__factory.abi,
    JonesUSDCIsolationModeVaultFactory__factory.bytecode,
    getJonesUSDCIsolationModeVaultFactoryConstructorParams(
      core,
      jonesUSDCRegistry,
      jUSDCToken,
      userVaultImplementation,
    ),
  );
}

export function createJonesUSDCIsolationModeTokenVaultV1(): Promise<JonesUSDCIsolationModeTokenVaultV1> {
  return createContractWithAbi(
    JonesUSDCIsolationModeTokenVaultV1__factory.abi,
    JonesUSDCIsolationModeTokenVaultV1__factory.bytecode,
    [],
  );
}

export function createJonesUSDCPriceOracle(
  core: CoreProtocol,
  jonesUSDCRegistry: JonesUSDCRegistry,
  djUSDCToken: { address: address },
  unwrapper: JonesUSDCIsolationModeUnwrapperTraderV2,
): Promise<JonesUSDCPriceOracle> {
  return createContractWithAbi<JonesUSDCPriceOracle>(
    JonesUSDCPriceOracle__factory.abi,
    JonesUSDCPriceOracle__factory.bytecode,
    getJonesUSDCPriceOracleConstructorParams(
      core,
      jonesUSDCRegistry,
      djUSDCToken,
      unwrapper,
    ),
  );
}

export function createJonesUSDCIsolationModeUnwrapperTraderV2(
  core: CoreProtocol,
  jonesUSDCRegistry: IJonesUSDCRegistry | JonesUSDCRegistry,
  djUSDCToken: { address: address },
): Promise<JonesUSDCIsolationModeUnwrapperTraderV2> {
  return createContractWithAbi<JonesUSDCIsolationModeUnwrapperTraderV2>(
    JonesUSDCIsolationModeUnwrapperTraderV2__factory.abi,
    JonesUSDCIsolationModeUnwrapperTraderV2__factory.bytecode,
    getJonesUSDCIsolationModeUnwrapperTraderV2ConstructorParams(core, jonesUSDCRegistry, djUSDCToken),
  );
}

export function createJonesUSDCRegistry(
  core: CoreProtocol,
  unwrapper: JonesUSDCIsolationModeUnwrapperTraderV2,
): Promise<JonesUSDCRegistry> {
  return createContractWithAbi<JonesUSDCRegistry>(
    JonesUSDCRegistry__factory.abi,
    JonesUSDCRegistry__factory.bytecode,
    getJonesUSDCRegistryConstructorParams(core, unwrapper),
  );
}

export function createJonesUSDCIsolationModeWrapperTraderV2(
  core: CoreProtocol,
  jonesRegistry: IJonesUSDCRegistry | JonesUSDCRegistry,
  djUSDCToken: { address: address },
): Promise<JonesUSDCIsolationModeWrapperTraderV2> {
  return createContractWithAbi<JonesUSDCIsolationModeWrapperTraderV2>(
    JonesUSDCIsolationModeWrapperTraderV2__factory.abi,
    JonesUSDCIsolationModeWrapperTraderV2__factory.bytecode,
    getJonesUSDCIsolationModeWrapperTraderV2ConstructorParams(core, jonesRegistry, djUSDCToken),
  );
}
