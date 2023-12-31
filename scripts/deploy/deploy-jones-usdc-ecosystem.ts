import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { BigNumber } from 'ethers';
import {
  JonesUSDCIsolationModeTokenVaultV1__factory,
  JonesUSDCIsolationModeUnwrapperTraderV2__factory,
  JonesUSDCIsolationModeVaultFactory__factory,
  JonesUSDCIsolationModeWrapperTraderV2__factory,
  JonesUSDCRegistry__factory,
} from '../../src/types';
import {
  getJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidationConstructorParams,
  getJonesUSDCIsolationModeUnwrapperTraderV2ForZapConstructorParams,
  getJonesUSDCIsolationModeVaultFactoryConstructorParams,
  getJonesUSDCIsolationModeWrapperTraderV2ConstructorParams,
  getJonesUSDCPriceOracleConstructorParams,
  getJonesUSDCRegistryConstructorParams,
} from '../../src/utils/constructors/jones';
import { getAndCheckSpecificNetwork } from '../../src/utils/dolomite-utils';
import { Network, TEN_BI, ZERO_BI } from '../../src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../test/utils/setup';
import { deployContractAndSave, prettyPrintEncodedData } from '../deploy-utils';

async function main() {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const jonesUSDCRegistryV1ImplementationAddress = await deployContractAndSave(
    Number(network),
    'JonesUSDCRegistry',
    [],
    'JonesUSDCRegistryV1Implementation',
  );
  const jonesUSDCRegistryV1Implementation = JonesUSDCRegistry__factory.connect(
    jonesUSDCRegistryV1ImplementationAddress,
    core.hhUser1,
  );
  const jonesUsdcRegistryAddress = await deployContractAndSave(
    Number(network),
    'RegistryProxy',
    await getJonesUSDCRegistryConstructorParams(jonesUSDCRegistryV1Implementation, core),
    'JonesUSDCRegistryProxy',
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

  const unwrapperForLiquidationAddress = await deployContractAndSave(
    Number(network),
    'JonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation',
    getJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidationConstructorParams(core, jonesUsdcRegistry, djUSDCToken),
  );
  const unwrapperForLiquidation = JonesUSDCIsolationModeUnwrapperTraderV2__factory.connect(
    unwrapperForLiquidationAddress,
    core.hhUser1,
  );
  const unwrapperForZapAddress = await deployContractAndSave(
    Number(network),
    'JonesUSDCIsolationModeUnwrapperTraderV2',
    getJonesUSDCIsolationModeUnwrapperTraderV2ForZapConstructorParams(core, jonesUsdcRegistry, djUSDCToken),
  );
  const unwrapperForZap = JonesUSDCIsolationModeUnwrapperTraderV2__factory.connect(
    unwrapperForZapAddress,
    core.hhUser1,
  );

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

  if ((await jonesUsdcRegistry.unwrapperTraderForLiquidation()) === ADDRESSES.ZERO) {
    console.log('Initializing unwrappers on JonesUSDCRegistry...');
    await jonesUsdcRegistry.initializeUnwrapperTraders(unwrapperForLiquidation.address, unwrapperForZap.address);
  }

  await prettyPrintEncodedData(
    core.dolomiteMargin.populateTransaction.ownerAddMarket(
      djUSDCToken.address,
      priceOracleAddress,
      core.interestSetters.alwaysZeroInterestSetter.address,
      { value: ZERO_BI }, // 115% collateralization
      { value: ZERO_BI },
      BigNumber.from(500_000).mul(TEN_BI.pow(await djUSDCToken.decimals())), // 500k units
      true,
      false,
    ),
    'dolomiteMargin.ownerAddMarket',
  );
  await prettyPrintEncodedData(
    djUSDCToken.populateTransaction.ownerInitialize([unwrapperForLiquidation.address, wrapper.address]),
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
