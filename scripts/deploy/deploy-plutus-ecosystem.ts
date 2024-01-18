import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import {
  PlutusVaultGLPIsolationModeTokenVaultV1__factory,
  PlutusVaultGLPIsolationModeUnwrapperTraderV1__factory,
  PlutusVaultGLPIsolationModeVaultFactory__factory,
  PlutusVaultGLPIsolationModeWrapperTraderV1__factory,
  PlutusVaultRegistry__factory,
} from '../../src/types';
import {
  getDolomiteCompatibleWhitelistForPlutusDAOConstructorParams,
  getPlutusVaultGLPIsolationModeUnwrapperTraderV1ConstructorParams,
  getPlutusVaultGLPIsolationModeVaultFactoryConstructorParams,
  getPlutusVaultGLPIsolationModeWrapperTraderV1ConstructorParams,
  getPlutusVaultGLPPriceOracleConstructorParams,
  getPlutusVaultRegistryConstructorParams,
} from '../../src/utils/constructors/plutus';
import { getAndCheckSpecificNetwork } from '../../packages/base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from '../../packages/base/src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../packages/base/test/utils/setup';
import { deployContractAndSave, prettyPrintEncodedData } from '../deploy-utils';

async function main() {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const plutusVaultRegistryImplementationAddress = await deployContractAndSave(
    Number(network),
    'PlutusVaultRegistry',
    [],
    'PlutusVaultRegistryV1Implementation',
  );
  const plutusVaultRegistryImplementation = PlutusVaultRegistry__factory.connect(
    plutusVaultRegistryImplementationAddress,
    core.hhUser1,
  );
  const plutusVaultRegistryAddress = await deployContractAndSave(
    Number(network),
    'RegistryProxy',
    await getPlutusVaultRegistryConstructorParams(plutusVaultRegistryImplementation, core),
    'PlutusVaultRegistryProxy',
  );
  const plutusVaultRegistry = PlutusVaultRegistry__factory.connect(plutusVaultRegistryAddress, core.hhUser1);

  const userVaultImplementationAddress = await deployContractAndSave(
    Number(network),
    'PlutusVaultGLPIsolationModeTokenVaultV1',
    [],
  );
  const userVaultImplementation = PlutusVaultGLPIsolationModeTokenVaultV1__factory.connect(
    userVaultImplementationAddress,
    core.hhUser1,
  );

  const dplvGlpTokenAddress = await deployContractAndSave(
    Number(network),
    'PlutusVaultGLPIsolationModeVaultFactory',
    getPlutusVaultGLPIsolationModeVaultFactoryConstructorParams(
      core,
      plutusVaultRegistry,
      core.plutusEcosystem!.plvGlp,
      userVaultImplementation,
    ),
  );
  const dplvGlpToken = PlutusVaultGLPIsolationModeVaultFactory__factory.connect(dplvGlpTokenAddress, core.hhUser1);

  const unwrapperAddress = await deployContractAndSave(
    Number(network),
    'PlutusVaultGLPIsolationModeUnwrapperTraderV1',
    getPlutusVaultGLPIsolationModeUnwrapperTraderV1ConstructorParams(core, plutusVaultRegistry, dplvGlpToken),
  );
  const unwrapper = PlutusVaultGLPIsolationModeUnwrapperTraderV1__factory.connect(unwrapperAddress, core.hhUser1);

  const wrapperAddress = await deployContractAndSave(
    Number(network),
    'PlutusVaultGLPIsolationModeWrapperTraderV1',
    getPlutusVaultGLPIsolationModeWrapperTraderV1ConstructorParams(core, plutusVaultRegistry, dplvGlpToken),
  );
  const wrapper = PlutusVaultGLPIsolationModeWrapperTraderV1__factory.connect(wrapperAddress, core.hhUser1);

  const priceOracleAddress = await deployContractAndSave(
    Number(network),
    'PlutusVaultGLPPriceOracle',
    getPlutusVaultGLPPriceOracleConstructorParams(core, plutusVaultRegistry, dplvGlpToken, unwrapper),
  );

  const farmWhitelist = await core.plutusEcosystem!.plvGlpFarm.whitelist();
  await deployContractAndSave(
    Number(network),
    'DolomiteCompatibleWhitelistForPlutusDAO',
    getDolomiteCompatibleWhitelistForPlutusDAOConstructorParams(core, unwrapper, wrapper, farmWhitelist, dplvGlpToken),
    'DolomiteWhitelistForPlutusChef',
  );

  const routerWhitelist = await core.plutusEcosystem!.plvGlpRouter.whitelist();
  await deployContractAndSave(
    Number(network),
    'DolomiteCompatibleWhitelistForPlutusDAO',
    getDolomiteCompatibleWhitelistForPlutusDAOConstructorParams(
      core,
      unwrapper,
      wrapper,
      routerWhitelist,
      dplvGlpToken,
    ),
    'DolomiteWhitelistForGlpDepositorV2',
  );

  await prettyPrintEncodedData(
    core.dolomiteMargin.populateTransaction.ownerAddMarket(
      dplvGlpToken.address,
      priceOracleAddress,
      core.interestSetters.alwaysZeroInterestSetter.address,
      { value: BigNumber.from('43478260869565217') }, // 4.347% --> 120% collateralization
      { value: ZERO_BI },
      '5000000000000000000000000', // 5M units
      true,
      false,
    ),
    'dolomiteMargin.ownerAddMarket',
  );
  await prettyPrintEncodedData(
    dplvGlpToken.populateTransaction.ownerInitialize([unwrapperAddress, wrapperAddress]),
    'dplvGlpToken.ownerInitialize',
  );
  await prettyPrintEncodedData(
    core.dolomiteMargin.populateTransaction.ownerSetGlobalOperator(dplvGlpToken.address, true),
    'dolomiteMargin.ownerSetGlobalOperator',
  );
  await prettyPrintEncodedData(
    core.liquidatorProxyV3!.populateTransaction.setMarketIdToTokenUnwrapperForLiquidationMap(
      await core.dolomiteMargin.getNumMarkets(),
      unwrapperAddress,
    ),
    'liquidatorProxyV3.setMarketIdToTokenUnwrapperForLiquidationMap',
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
