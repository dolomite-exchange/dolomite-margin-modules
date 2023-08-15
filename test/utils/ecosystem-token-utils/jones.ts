import { address } from '@dolomite-exchange/dolomite-margin';
import {
  IJonesUSDCIsolationModeTokenVaultV1,
  IJonesUSDCRegistry,
  JonesUSDCIsolationModeTokenVaultV1,
  JonesUSDCIsolationModeTokenVaultV1__factory,
  JonesUSDCIsolationModeUnwrapperTraderV2,
  JonesUSDCIsolationModeUnwrapperTraderV2__factory,
  JonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation,
  JonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation__factory,
  JonesUSDCIsolationModeVaultFactory,
  JonesUSDCIsolationModeVaultFactory__factory,
  JonesUSDCIsolationModeWrapperTraderV2,
  JonesUSDCIsolationModeWrapperTraderV2__factory,
  JonesUSDCPriceOracle,
  JonesUSDCPriceOracle__factory,
  JonesUSDCWithChainlinkAutomationPriceOracle,
  JonesUSDCWithChainlinkAutomationPriceOracle__factory,
  JonesUSDCRegistry,
  JonesUSDCRegistry__factory,
  RegistryProxy,
  RegistryProxy__factory,
} from '../../../src/types';
import {
  getJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidationConstructorParams,
  getJonesUSDCIsolationModeUnwrapperTraderV2ForZapConstructorParams,
  getJonesUSDCIsolationModeVaultFactoryConstructorParams,
  getJonesUSDCIsolationModeWrapperTraderV2ConstructorParams,
  getJonesUSDCWithChainlinkAutomationPriceOracleConstructorParams,
  getJonesUSDCPriceOracleConstructorParams,
  getJonesUSDCRegistryConstructorParams,
} from '../../../src/utils/constructors/jones';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { CoreProtocol } from '../setup';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

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
): Promise<JonesUSDCPriceOracle> {
  return createContractWithAbi<JonesUSDCPriceOracle>(
    JonesUSDCPriceOracle__factory.abi,
    JonesUSDCPriceOracle__factory.bytecode,
    getJonesUSDCPriceOracleConstructorParams(
      core,
      jonesUSDCRegistry,
      djUSDCToken,
    ),
  );
}

export async function createJonesUSDCWithChainlinkAutomationPriceOracle(
  core: CoreProtocol,
  chainlinkRegistry: string,
  jonesUSDCRegistry: JonesUSDCRegistry,
  djUSDCToken: { address: address },
): Promise<JonesUSDCWithChainlinkAutomationPriceOracle> {
  return createContractWithAbi(
    JonesUSDCWithChainlinkAutomationPriceOracle__factory.abi,
    JonesUSDCWithChainlinkAutomationPriceOracle__factory.bytecode,
    getJonesUSDCWithChainlinkAutomationPriceOracleConstructorParams(
      core,
      chainlinkRegistry,
      jonesUSDCRegistry,
      djUSDCToken,
    ),
  );
}

export function createJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation(
  core: CoreProtocol,
  jonesUSDCRegistry: IJonesUSDCRegistry | JonesUSDCRegistry,
  djUSDCToken: { address: address },
): Promise<JonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation> {
  return createContractWithAbi<JonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation>(
    JonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation__factory.abi,
    JonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation__factory.bytecode,
    getJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidationConstructorParams(core, jonesUSDCRegistry, djUSDCToken),
  );
}

export function createJonesUSDCIsolationModeUnwrapperTraderV2ForZap(
  core: CoreProtocol,
  jonesUSDCRegistry: IJonesUSDCRegistry | JonesUSDCRegistry,
  djUSDCToken: { address: address },
): Promise<JonesUSDCIsolationModeUnwrapperTraderV2> {
  return createContractWithAbi<JonesUSDCIsolationModeUnwrapperTraderV2>(
    JonesUSDCIsolationModeUnwrapperTraderV2__factory.abi,
    JonesUSDCIsolationModeUnwrapperTraderV2__factory.bytecode,
    getJonesUSDCIsolationModeUnwrapperTraderV2ForZapConstructorParams(core, jonesUSDCRegistry, djUSDCToken),
  );
}

export async function createJonesUSDCRegistry(
  core: CoreProtocol,
): Promise<JonesUSDCRegistry> {
  const implementation = await createContractWithAbi<JonesUSDCRegistry>(
    JonesUSDCRegistry__factory.abi,
    JonesUSDCRegistry__factory.bytecode,
    [],
  );
  const proxy = await createContractWithAbi<RegistryProxy>(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getJonesUSDCRegistryConstructorParams(implementation, core),
  );
  return JonesUSDCRegistry__factory.connect(proxy.address, core.hhUser1);
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
