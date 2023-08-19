import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import {
  PendlePtGLP2024IsolationModeTokenVaultV1__factory,
  PendlePtGLP2024IsolationModeUnwrapperTraderV2__factory,
  PendlePtGLP2024IsolationModeVaultFactory__factory,
  PendlePtGLP2024IsolationModeWrapperTraderV2__factory,
  PendlePtGLP2024Registry__factory,
} from '../../src/types';
import { Network, TEN_BI, ZERO_BI } from '../../src/utils/no-deps-constants';
import {
  getPendlePtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams,
  getPendlePtGLP2024IsolationModeVaultFactoryConstructorParams,
  getPendlePtGLP2024IsolationModeWrapperTraderV2ConstructorParams,
  getPendlePtGLP2024RegistryConstructorParams,
  getPendlePtGLPPriceOracleConstructorParams,
} from '../../src/utils/constructors/pendle';
import { setupCoreProtocol } from '../../test/utils/setup';
import { deployContractAndSave, prettyPrintEncodedData } from '../deploy-utils';

async function main() {
  const network = (await ethers.provider.getNetwork()).chainId.toString() as Network;
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const pendleRegistryAddress = await deployContractAndSave(
    Number(network),
    'PendlePtGLP2024Registry',
    getPendlePtGLP2024RegistryConstructorParams(core),
  );
  const pendleRegistry = PendlePtGLP2024Registry__factory.connect(pendleRegistryAddress, core.hhUser1);

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

  await prettyPrintEncodedData(
    core.dolomiteMargin.populateTransaction.ownerAddMarket(
      dptGlpToken.address,
      priceOracleAddress,
      core.alwaysZeroInterestSetter.address,
      { value: BigNumber.from('43478260869565217') }, // 4.347% --> 120% collateralization
      { value: ZERO_BI },
      BigNumber.from(500_000).mul(TEN_BI.pow(await dptGlpToken.decimals())), // 500k units
      true,
      false,
    ),
    'dolomiteMargin.ownerAddMarket',
  );
  await prettyPrintEncodedData(
    dptGlpToken.populateTransaction.ownerInitialize([unwrapper.address, wrapper.address]),
    'dptGlpToken.ownerInitialize',
  );
  await prettyPrintEncodedData(
    core.dolomiteMargin.populateTransaction.ownerSetGlobalOperator(dptGlpToken.address, true),
    'dolomiteMargin.ownerSetGlobalOperator',
  );
  const expectedMarketId = 11; // deploy this after jUSDC
  await prettyPrintEncodedData(
    core.liquidatorAssetRegistry!.populateTransaction.ownerAddLiquidatorToAssetWhitelist(
      expectedMarketId,
      core.liquidatorProxyV4.address,
    ),
    'liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist',
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
