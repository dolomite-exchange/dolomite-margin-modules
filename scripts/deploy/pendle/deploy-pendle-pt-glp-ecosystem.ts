import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import {
  PendleGLPRegistry__factory,
  PendlePtGLP2024IsolationModeTokenVaultV1__factory,
  PendlePtGLP2024IsolationModeUnwrapperTraderV2__factory,
  PendlePtGLP2024IsolationModeVaultFactory__factory,
  PendlePtGLP2024IsolationModeWrapperTraderV2__factory,
} from '../../../src/types';
import {
  getPendleGLPRegistryConstructorParams,
  getPendlePtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams,
  getPendlePtGLP2024IsolationModeVaultFactoryConstructorParams,
  getPendlePtGLP2024IsolationModeWrapperTraderV2ConstructorParams,
  getPendlePtGLPPriceOracleConstructorParams,
} from '../../../src/utils/constructors/pendle';
import { Network, TEN_BI, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../../test/utils/setup';
import { deployContractAndSave, prettyPrintEncodedDataWithTypeSafety } from '../../deploy-utils';

async function main() {
  const network = (await ethers.provider.getNetwork()).chainId.toString() as Network;
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const pendleRegistryImplementationAddress = await deployContractAndSave(
    Number(network),
    'PendleGLPRegistry',
    [],
    'PendleGLP2024RegistryV1Implementation',
  );
  const pendleRegistryImplementation = PendleGLPRegistry__factory.connect(
    pendleRegistryImplementationAddress,
    core.hhUser1,
  );
  const pendleRegistryAddress = await deployContractAndSave(
    Number(network),
    'RegistryProxy',
    await getPendleGLPRegistryConstructorParams(pendleRegistryImplementation, core),
    'PendleGLP2024RegistryProxy',
  );
  const pendleRegistry = PendleGLPRegistry__factory.connect(pendleRegistryAddress, core.hhUser1);

  const userVaultImplementationAddress = await deployContractAndSave(
    Number(network),
    'PendlePtGLP2024IsolationModeTokenVaultV1',
    [],
  );
  const userVaultImplementation = PendlePtGLP2024IsolationModeTokenVaultV1__factory.connect(
    userVaultImplementationAddress,
    core.hhUser1,
  );

  const dptGlpTokenAddress = await deployContractAndSave(
    Number(network),
    'PendlePtGLP2024IsolationModeVaultFactory',
    getPendlePtGLP2024IsolationModeVaultFactoryConstructorParams(
      core,
      pendleRegistry,
      core.pendleEcosystem!.ptGlpToken,
      userVaultImplementation,
    ),
  );
  const dptGlpToken = PendlePtGLP2024IsolationModeVaultFactory__factory.connect(dptGlpTokenAddress, core.hhUser1);

  const unwrapperAddress = await deployContractAndSave(
    Number(network),
    'PendlePtGLP2024IsolationModeUnwrapperTraderV2',
    getPendlePtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams(core, dptGlpToken, pendleRegistry),
  );
  const unwrapper = PendlePtGLP2024IsolationModeUnwrapperTraderV2__factory.connect(unwrapperAddress, core.hhUser1);

  const wrapperAddress = await deployContractAndSave(
    Number(network),
    'PendlePtGLP2024IsolationModeWrapperTraderV2',
    getPendlePtGLP2024IsolationModeWrapperTraderV2ConstructorParams(core, dptGlpToken, pendleRegistry),
  );
  const wrapper = PendlePtGLP2024IsolationModeWrapperTraderV2__factory.connect(wrapperAddress, core.hhUser1);

  const priceOracleAddress = await deployContractAndSave(
    Number(network),
    'PendlePtGLPPriceOracle',
    getPendlePtGLPPriceOracleConstructorParams(core, dptGlpToken, pendleRegistry),
  );

  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'dolomiteMargin',
    'ownerAddMarket',
    [
      dptGlpToken.address,
      priceOracleAddress,
      core.interestSetters.alwaysZeroInterestSetter.address,
      { value: BigNumber.from('43478260869565217') }, // 4.347% --> 120% collateralization
      { value: ZERO_BI },
      BigNumber.from(500_000).mul(TEN_BI.pow(await dptGlpToken.decimals())), // 500k units
      true,
      false,
    ],
  );
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    { dptGlpToken },
    'dptGlpToken',
    'ownerInitialize',
    [[unwrapper.address, wrapper.address]],
  );
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'dolomiteMargin',
    'ownerSetGlobalOperator',
    [dptGlpToken.address, true],
  );
  const expectedMarketId = 11; // deploy this after jUSDC
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'liquidatorAssetRegistry',
    'ownerAddLiquidatorToAssetWhitelist',
    [expectedMarketId, core.liquidatorProxyV4.address],
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
