import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import {
  JonesUSDCIsolationModeTokenVaultV1__factory,
  JonesUSDCIsolationModeUnwrapperTraderV2__factory,
  JonesUSDCIsolationModeVaultFactory__factory,
  JonesUSDCIsolationModeWrapperTraderV2__factory,
  JonesUSDCRegistry__factory,
} from 'src/types';
import { Network, TEN_BI, ZERO_BI } from 'src/utils/no-deps-constants';
import {
  getJonesUSDCIsolationModeUnwrapperTraderV2ConstructorParams,
  getJonesUSDCIsolationModeVaultFactoryConstructorParams,
  getJonesUSDCIsolationModeWrapperTraderV2ConstructorParams,
  getJonesUSDCPriceOracleConstructorParams,
  getJonesUSDCRegistryConstructorParams,
} from '../src/utils/constructors/jones';
import { setupCoreProtocol } from '../test/utils/setup';
import { deployContractAndSave, prettyPrintEncodedData } from './deploy-utils';

async function main() {
  const network = (await ethers.provider.getNetwork()).chainId.toString() as Network;
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const jonesUsdcRegistryAddress = await deployContractAndSave(
    Number(network),
    'JonesUSDCRegistry',
    getJonesUSDCRegistryConstructorParams(core),
  );
  const jonesUsdcRegistry = JonesUSDCRegistry__factory.connect(jonesUsdcRegistryAddress, core.hhUser1);

  const userVaultImplementationAddress = await deployContractAndSave(
    Number(network),
    'JonesUSDCIsolationModeTokenVaultV1',
    [],
  );
  const userVaultImplementation = JonesUSDCIsolationModeTokenVaultV1__factory.connect(
    userVaultImplementationAddress,
    core.hhUser1,
  );

  const djUSDCTokenAddress = await deployContractAndSave(
    Number(network),
    'JonesUSDCIsolationModeVaultFactory',
    getJonesUSDCIsolationModeVaultFactoryConstructorParams(
      core,
      jonesUsdcRegistry,
      core.jonesEcosystem!.jUSDC,
      userVaultImplementation,
    ),
  );
  const djUSDCToken = JonesUSDCIsolationModeVaultFactory__factory.connect(djUSDCTokenAddress, core.hhUser1);

  const unwrapperAddress = await deployContractAndSave(
    Number(network),
    'JonesUSDCIsolationModeUnwrapperTraderV2',
    getJonesUSDCIsolationModeUnwrapperTraderV2ConstructorParams(core, jonesUsdcRegistry, djUSDCToken),
  );
  const unwrapper = JonesUSDCIsolationModeUnwrapperTraderV2__factory.connect(unwrapperAddress, core.hhUser1);

  const wrapperAddress = await deployContractAndSave(
    Number(network),
    'JonesUSDCIsolationModeWrapperTraderV2',
    getJonesUSDCIsolationModeWrapperTraderV2ConstructorParams(core, jonesUsdcRegistry, djUSDCToken),
  );
  const wrapper = JonesUSDCIsolationModeWrapperTraderV2__factory.connect(wrapperAddress, core.hhUser1);

  const priceOracleAddress = await deployContractAndSave(
    Number(network),
    'JonesUSDCPriceOracle',
    getJonesUSDCPriceOracleConstructorParams(core, jonesUsdcRegistry, djUSDCToken),
  );

  await prettyPrintEncodedData(
    core.dolomiteMargin.populateTransaction.ownerAddMarket(
      djUSDCToken.address,
      priceOracleAddress,
      core.alwaysZeroInterestSetter.address,
      { value: ZERO_BI }, // 115% collateralization
      { value: ZERO_BI },
      BigNumber.from(500_000).mul(TEN_BI.pow(await djUSDCToken.decimals())), // 500k units
      true,
      false,
    ),
    'dolomiteMargin.ownerAddMarket',
  );
  await prettyPrintEncodedData(
    djUSDCToken.populateTransaction.ownerInitialize([unwrapper.address, wrapper.address]),
    'djUSDCToken.ownerInitialize',
  );
  await prettyPrintEncodedData(
    core.dolomiteMargin.populateTransaction.ownerSetGlobalOperator(djUSDCToken.address, true),
    'dolomiteMargin.ownerSetGlobalOperator',
  );
  const expectedMarketId = 10;
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
