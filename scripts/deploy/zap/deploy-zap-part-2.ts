import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { ethers } from 'hardhat';
import {
  DolomiteRegistryImplementation,
  GmxRegistryV1__factory,
  IGmxRegistryV1,
  IGmxRegistryV1__factory,
  IJonesUSDCRegistry,
  IJonesUSDCRegistry__factory,
  IPendleGLPRegistry,
  IPendleGLPRegistry__factory,
  IPlutusVaultRegistry,
  IPlutusVaultRegistry__factory,
  JonesUSDCRegistry__factory,
  PendleGLPRegistry__factory,
  PlutusVaultGLPIsolationModeUnwrapperTraderV2__factory,
  PlutusVaultRegistry__factory,
  RegistryProxy__factory,
} from '../../../src/types';
import {
  getGLPPriceOracleV1ConstructorParams,
  getGLPIsolationModeUnwrapperTraderV2ConstructorParams,
  getGLPIsolationModeWrapperTraderV2ConstructorParams,
  getGmxRegistryConstructorParams,
} from '../../../src/utils/constructors/gmx';
import {
  getJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidationConstructorParams,
  getJonesUSDCIsolationModeUnwrapperTraderV2ForZapConstructorParams,
  getJonesUSDCIsolationModeWrapperTraderV2ConstructorParams,
  getJonesUSDCPriceOracleConstructorParams,
  getJonesUSDCRegistryConstructorParams,
} from '../../../src/utils/constructors/jones';
import {
  getPendleGLPRegistryConstructorParams,
  getPendlePtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams,
  getPendlePtGLP2024IsolationModeWrapperTraderV2ConstructorParams,
  getPendlePtGLPPriceOracleConstructorParams,
} from '../../../src/utils/constructors/pendle';
import {
  getPlutusVaultGLPIsolationModeUnwrapperTraderV2ConstructorParams,
  getPlutusVaultGLPIsolationModeWrapperTraderV2ConstructorParams,
  getPlutusVaultGLPPriceOracleConstructorParams,
  getPlutusVaultRegistryConstructorParams,
} from '../../../src/utils/constructors/plutus';
import { Network } from '../../../packages/base/src/utils/no-deps-constants';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from '../../../packages/base/test/utils/setup';
import { deployContractAndSave, prettyPrintEncodedData } from '../../deploy-utils';

const oldLiquidatorAddress = '0xac66E962A1C52B8a3B32AF432a60fFDBc99ebD0b';

async function deployGmxContracts(network: Network, core: CoreProtocol) {
  const gmxRegistryImplementationAddress = await deployContractAndSave(
    Number(network),
    'GmxRegistryV1',
    [],
    'GmxRegistryV1Implementation',
  );
  const gmxRegistryImplementation = GmxRegistryV1__factory.connect(gmxRegistryImplementationAddress, core.hhUser1);
  const gmxRegistryAddress = await deployContractAndSave(
    Number(network),
    'RegistryProxy',
    await getGmxRegistryConstructorParams(gmxRegistryImplementation, core),
    'GmxRegistryProxy',
  );
  const gmxRegistry = IGmxRegistryV1__factory.connect(gmxRegistryAddress, core.hhUser1);
  const glpTokenVaultAddress = await deployContractAndSave(
    Number(network),
    'GLPIsolationModeTokenVaultV1',
    [],
  );
  const glpUnwrapperV2Address = await deployContractAndSave(
    Number(network),
    'GLPIsolationModeUnwrapperTraderV2',
    getGLPIsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      core.gmxEcosystem!.live.dGlp,
      gmxRegistry,
    ),
  );
  const glpWrapperV2Address = await deployContractAndSave(
    Number(network),
    'GLPIsolationModeWrapperTraderV2',
    getGLPIsolationModeWrapperTraderV2ConstructorParams(
      core,
      core.gmxEcosystem!.live.dGlp,
      gmxRegistry,
    ),
  );
  const glpPriceOracleAddress = await deployContractAndSave(
    Number(network),
    'GLPPriceOracleV1',
    getGLPPriceOracleV1ConstructorParams(
      core.gmxEcosystem!.live.dGlp,
      gmxRegistry,
    ),
  );
  return {
    gmxRegistry,
    glpTokenVaultAddress,
    glpUnwrapperV2Address,
    glpWrapperV2Address,
    glpPriceOracleAddress,
  };
}

async function deployJonesUSDCContracts(network: Network, core: CoreProtocol) {
  const jonesUsdcRegistryImplementationAddress = await deployContractAndSave(
    Number(network),
    'JonesUSDCRegistry',
    [],
    'JonesUSDCRegistryV1Implementation',
  );
  const jonesUsdcRegistryImplementation = JonesUSDCRegistry__factory.connect(
    jonesUsdcRegistryImplementationAddress,
    core.hhUser1,
  );
  const jonesUsdcRegistryAddress = await deployContractAndSave(
    Number(network),
    'RegistryProxy',
    await getJonesUSDCRegistryConstructorParams(jonesUsdcRegistryImplementation, core),
    'JonesUSDCRegistryProxy',
  );
  const jonesUsdcRegistry = IJonesUSDCRegistry__factory.connect(jonesUsdcRegistryAddress, core.hhUser1);
  const jUSDCTokenVaultAddress = await deployContractAndSave(
    Number(network),
    'JonesUSDCIsolationModeTokenVaultV1',
    [],
  );
  const jUSDCUnwrapperV2ForLiquidationAddress = await deployContractAndSave(
    Number(network),
    'JonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation',
    getJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidationConstructorParams(
      core,
      jonesUsdcRegistry,
      core.jonesEcosystem!.live.jUSDCIsolationModeFactory,
    ),
  );
  const jUSDCUnwrapperV2ForZapAddress = await deployContractAndSave(
    Number(network),
    'JonesUSDCIsolationModeUnwrapperTraderV2',
    getJonesUSDCIsolationModeUnwrapperTraderV2ForZapConstructorParams(
      core,
      jonesUsdcRegistry,
      core.jonesEcosystem!.live.jUSDCIsolationModeFactory,
    ),
  );
  const jUSDCWrapperV2Address = await deployContractAndSave(
    Number(network),
    'JonesUSDCIsolationModeWrapperTraderV2',
    getJonesUSDCIsolationModeWrapperTraderV2ConstructorParams(
      core,
      jonesUsdcRegistry,
      core.jonesEcosystem!.live.jUSDCIsolationModeFactory,
    ),
  );
  const isInitialized = await jonesUsdcRegistry.unwrapperTraderForLiquidation() !== ZERO_ADDRESS;
  if (!isInitialized) {
    console.log('Calling #initializeUnwrapperTraders on JonesUSDCRegistry...');
    await jonesUsdcRegistry.initializeUnwrapperTraders(
      jUSDCUnwrapperV2ForLiquidationAddress,
      jUSDCUnwrapperV2ForZapAddress,
    );
  }
  const jUSDCPriceOracleAddress = await deployContractAndSave(
    Number(network),
    'JonesUSDCPriceOracle',
    getJonesUSDCPriceOracleConstructorParams(
      core,
      jonesUsdcRegistry,
      core.jonesEcosystem!.live.jUSDCIsolationModeFactory,
    ),
  );

  return {
    jonesUsdcRegistry,
    jUSDCTokenVaultAddress,
    jUSDCUnwrapperV2ForLiquidationAddress,
    jUSDCUnwrapperV2ForZapAddress,
    jUSDCWrapperV2Address,
    jUSDCPriceOracleAddress,
  };
}

async function deployPendleGLPContracts(network: Network, core: CoreProtocol) {
  const pendlePtGLPRegistryImplementationAddress = await deployContractAndSave(
    Number(network),
    'PendleGLPRegistry',
    [],
    'PendleGLP2024RegistryV1Implementation',
  );
  const pendleRegistryImplementation = PendleGLPRegistry__factory.connect(
    pendlePtGLPRegistryImplementationAddress,
    core.hhUser1,
  );
  const pendleRegistryAddress = await deployContractAndSave(
    Number(network),
    'RegistryProxy',
    await getPendleGLPRegistryConstructorParams(pendleRegistryImplementation, core),
    'PendleGLPRegistryProxy',
  );
  const pendleRegistry = IPendleGLPRegistry__factory.connect(pendleRegistryAddress, core.hhUser1);
  const pendlePtGlpTokenVaultAddress = await deployContractAndSave(
    Number(network),
    'PendleGLPIsolationModeTokenVaultV1',
    [],
  );
  const pendlePtGlpUnwrapperV2Address = await deployContractAndSave(
    Number(network),
    'PendleGLPIsolationModeUnwrapperTraderV2',
    getPendlePtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem!.glpMar2024.dPtGlp2024,
      pendleRegistry,
    ),
  );
  const pendlePtGlpWrapperV2Address = await deployContractAndSave(
    Number(network),
    'PendleGLPIsolationModeWrapperTraderV2',
    getPendlePtGLP2024IsolationModeWrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem!.glpMar2024.dPtGlp2024,
      pendleRegistry,
    ),
  );
  const pendlePtGlpPriceOracleAddress = await deployContractAndSave(
    Number(network),
    'PendlePtGLPPriceOracle',
    getPendlePtGLPPriceOracleConstructorParams(
      core,
      core.pendleEcosystem!.glpMar2024.dPtGlp2024,
      pendleRegistry,
    ),
  );
  return {
    pendleRegistry,
    pendlePtGlpTokenVaultAddress,
    pendlePtGlpUnwrapperV2Address,
    pendlePtGlpWrapperV2Address,
    pendlePtGlpPriceOracleAddress,
  };
}

async function deployPlutusVaultGLPContracts(network: Network, core: CoreProtocol) {
  const plutusVaultGLPRegistryImplementationAddress = await deployContractAndSave(
    Number(network),
    'PlutusVaultRegistry',
    [],
    'PlutusVaultRegistryV1Implementation',
  );
  const pendleRegistryImplementation = PlutusVaultRegistry__factory.connect(
    plutusVaultGLPRegistryImplementationAddress,
    core.hhUser1,
  );
  const plutusVaultRegistryAddress = await deployContractAndSave(
    Number(network),
    'RegistryProxy',
    await getPlutusVaultRegistryConstructorParams(pendleRegistryImplementation, core),
    'PlutusVaultRegistryProxy',
  );
  const plutusVaultRegistry = IPlutusVaultRegistry__factory.connect(plutusVaultRegistryAddress, core.hhUser1);
  const plvGlpTokenVaultAddress = await deployContractAndSave(
    Number(network),
    'PlutusVaultGLPIsolationModeTokenVaultV1',
    [],
  );
  const plvGlpUnwrapperV2Address = await deployContractAndSave(
    Number(network),
    'PlutusVaultGLPIsolationModeUnwrapperTraderV2',
    getPlutusVaultGLPIsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      plutusVaultRegistry,
      core.plutusEcosystem!.live.plvGlpIsolationModeFactory,
    ),
  );
  const plvGlpWrapperV2Address = await deployContractAndSave(
    Number(network),
    'PlutusVaultGLPIsolationModeWrapperTraderV2',
    getPlutusVaultGLPIsolationModeWrapperTraderV2ConstructorParams(
      core,
      plutusVaultRegistry,
      core.plutusEcosystem!.live.plvGlpIsolationModeFactory,
    ),
  );
  const plvGlpPriceOracleAddress = await deployContractAndSave(
    Number(network),
    'PlutusVaultGLPPriceOracle',
    getPlutusVaultGLPPriceOracleConstructorParams(
      core,
      plutusVaultRegistry,
      core.plutusEcosystem!.live.plvGlpIsolationModeFactory,
      PlutusVaultGLPIsolationModeUnwrapperTraderV2__factory.connect(plvGlpUnwrapperV2Address, core.hhUser1),
    ),
  );

  return {
    plutusVaultRegistry,
    plvGlpTokenVaultAddress,
    plvGlpUnwrapperV2Address,
    plvGlpWrapperV2Address,
    plvGlpPriceOracleAddress,
  };
}

async function encodeGmxTransactions(
  core: CoreProtocol,
  gmxRegistry: IGmxRegistryV1,
  glpTokenVaultAddress: string,
  glpUnwrapperV2Address: string,
  glpWrapperV2Address: string,
  glpPriceOracleAddress: string,
) {
  await prettyPrintEncodedData(
    core.liquidatorAssetRegistry.populateTransaction.ownerRemoveLiquidatorFromAssetWhitelist(
      core.marketIds.dfsGlp!,
      oldLiquidatorAddress,
    ),
    'liquidatorAssetRegistry.ownerRemoveLiquidatorFromAssetWhitelist(dfsGlp, oldLiquidator)',
  );
  await prettyPrintEncodedData(
    core.liquidatorAssetRegistry.populateTransaction.ownerAddLiquidatorToAssetWhitelist(
      core.marketIds.dfsGlp!,
      core.liquidatorProxyV4.address,
    ),
    'liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(dfsGlp, newLiquidator)',
  );
  await prettyPrintEncodedData(
    core.gmxEcosystem!.live.dGlp.populateTransaction.setIsTokenConverterTrusted(
      glpUnwrapperV2Address,
      true,
    ),
    'glpIsolationModeFactory.setIsTokenConverterTrusted(glpUnwrapperV2, true)',
  );
  await prettyPrintEncodedData(
    core.gmxEcosystem!.live.dGlp.populateTransaction.setIsTokenConverterTrusted(
      glpWrapperV2Address,
      true,
    ),
    'glpIsolationModeFactory.setIsTokenConverterTrusted(glpWrapperV2, true)',
  );
  await prettyPrintEncodedData(
    core.gmxEcosystem!.live.dGlp.populateTransaction.setIsTokenConverterTrusted(
      '0xF25E0d08ED3f692D3AA5195d781Cd858179c582D',
      false,
    ),
    'glpIsolationModeFactory.setIsTokenConverterTrusted(glpUnwrapperV2Old, false)',
  );
  await prettyPrintEncodedData(
    core.gmxEcosystem!.live.dGlp.populateTransaction.setIsTokenConverterTrusted(
      '0x815EbfF233430b8c7e10420519bD42C3F81729fc',
      false,
    ),
    'glpIsolationModeFactory.setIsTokenConverterTrusted(glpWrapperV2Old, false)',
  );
  await prettyPrintEncodedData(
    core.gmxEcosystem!.live.dGlp.populateTransaction.setGmxRegistry(gmxRegistry.address),
    'glpIsolationModeFactory.setGmxRegistry(gmxRegistry)',
  );
  await prettyPrintEncodedData(
    core.gmxEcosystem!.live.dGlp.populateTransaction.setUserVaultImplementation(
      glpTokenVaultAddress,
    ),
    'glpIsolationModeFactory.setUserVaultImplementation(glpTokenVaultAddress)',
  );
  await prettyPrintEncodedData(
    core.dolomiteMargin.populateTransaction.ownerSetPriceOracle(core.marketIds.dfsGlp!, glpPriceOracleAddress),
    'dolomiteMargin.ownerSetPriceOracle(dfsGlp, glpPriceOracleAddress)',
  );
}

async function encodeJonesUSDCTransactions(
  core: CoreProtocol,
  jonesUSDCRegistry: IJonesUSDCRegistry,
  jUSDCTokenVaultAddress: string,
  jUSDCUnwrapperV2ForLiquidationAddress: string,
  jUSDCUnwrapperV2ForZapAddress: string,
  jUSDCWrapperV2Address: string,
  jUSDCPriceOracleAddress: string,
) {
  await prettyPrintEncodedData(
    core.liquidatorAssetRegistry.populateTransaction.ownerRemoveLiquidatorFromAssetWhitelist(
      core.marketIds.djUSDC!,
      oldLiquidatorAddress,
    ),
    'liquidatorAssetRegistry.ownerRemoveLiquidatorFromAssetWhitelist(djUSDC, oldLiquidator)',
  );
  await prettyPrintEncodedData(
    core.liquidatorAssetRegistry.populateTransaction.ownerAddLiquidatorToAssetWhitelist(
      core.marketIds.djUSDC!,
      core.liquidatorProxyV4.address,
    ),
    'liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(djUSDC, newLiquidator)',
  );
  await prettyPrintEncodedData(
    core.jonesEcosystem!.live.jUSDCIsolationModeFactory.populateTransaction.ownerSetIsTokenConverterTrusted(
      jUSDCUnwrapperV2ForLiquidationAddress,
      true,
    ),
    'jUSDCIsolationModeFactory.ownerSetIsTokenConverterTrusted(jUSDCUnwrapperV2ForLiquidationAddress, true)',
  );
  await prettyPrintEncodedData(
    core.jonesEcosystem!.live.jUSDCIsolationModeFactory.populateTransaction.ownerSetIsTokenConverterTrusted(
      jUSDCUnwrapperV2ForZapAddress,
      true,
    ),
    'jUSDCIsolationModeFactory.ownerSetIsTokenConverterTrusted(jUSDCUnwrapperV2ForZapAddress, true)',
  );
  await prettyPrintEncodedData(
    core.jonesEcosystem!.live.jUSDCIsolationModeFactory.populateTransaction.ownerSetIsTokenConverterTrusted(
      jUSDCWrapperV2Address,
      true,
    ),
    'jUSDCIsolationModeFactory.ownerSetIsTokenConverterTrusted(jUSDCWrapperV2Address, true)',
  );
  await prettyPrintEncodedData(
    core.jonesEcosystem!.live.jUSDCIsolationModeFactory.populateTransaction.ownerSetIsTokenConverterTrusted(
      '0x87763A4F392BDFD00C39F264DB63a0B93831Ac08',
      false,
    ),
    'jUSDCIsolationModeFactory.ownerSetIsTokenConverterTrusted(jUSDCUnwrapperV2Old, false)',
  );
  await prettyPrintEncodedData(
    core.jonesEcosystem!.live.jUSDCIsolationModeFactory.populateTransaction.ownerSetIsTokenConverterTrusted(
      '0xbC502907BFc41D1bd3b4F4c7269eA15be7EB93d0',
      false,
    ),
    'jUSDCIsolationModeFactory.ownerSetIsTokenConverterTrusted(jUSDCWrapperV2Old, false)',
  );
  await prettyPrintEncodedData(
    core.jonesEcosystem!.live.jUSDCIsolationModeFactory.populateTransaction.ownerSetJonesUSDCRegistry(
      jonesUSDCRegistry.address,
    ),
    'jUSDCIsolationModeFactory.ownerSetJonesUSDCRegistry(jonesUSDCRegistry)',
  );
  await prettyPrintEncodedData(
    core.jonesEcosystem!.live.jUSDCIsolationModeFactory.populateTransaction.ownerSetUserVaultImplementation(
      jUSDCTokenVaultAddress,
    ),
    'jUSDCIsolationModeFactory.ownerSetUserVaultImplementation(jUSDCTokenVaultAddress)',
  );
  await prettyPrintEncodedData(
    core.dolomiteMargin.populateTransaction.ownerSetPriceOracle(core.marketIds.djUSDC!, jUSDCPriceOracleAddress),
    'dolomiteMargin.ownerSetPriceOracle(djUSDC, jUSDCPriceOracleAddress)',
  );
}

async function encodePendleGLPTransactions(
  core: CoreProtocol,
  pendleRegistry: IPendleGLPRegistry,
  pendlePtGlpTokenVaultAddress: string,
  pendlePtGlpUnwrapperV2Address: string,
  pendlePtGlpWrapperV2Address: string,
  pendlePtGlpPriceOracleAddress: string,
) {
  await prettyPrintEncodedData(
    core.liquidatorAssetRegistry.populateTransaction.ownerRemoveLiquidatorFromAssetWhitelist(
      core.marketIds.dPtGlp!,
      oldLiquidatorAddress,
    ),
    'liquidatorAssetRegistry.ownerRemoveLiquidatorFromAssetWhitelist(dPtGlp, oldLiquidator)',
  );
  await prettyPrintEncodedData(
    core.liquidatorAssetRegistry.populateTransaction.ownerAddLiquidatorToAssetWhitelist(
      core.marketIds.dPtGlp!,
      core.liquidatorProxyV4.address,
    ),
    'liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(dPtGlp, newLiquidator)',
  );
  await prettyPrintEncodedData(
    core.pendleEcosystem!.glpMar2024.dPtGlp2024.populateTransaction.ownerSetIsTokenConverterTrusted(
      pendlePtGlpUnwrapperV2Address,
      true,
    ),
    'pendlePtGlpIsolationModeFactory.ownerSetIsTokenConverterTrusted(pendlePtGlpUnwrapperV2Address, true)',
  );
  await prettyPrintEncodedData(
    core.pendleEcosystem!.glpMar2024.dPtGlp2024.populateTransaction.ownerSetIsTokenConverterTrusted(
      pendlePtGlpWrapperV2Address,
      true,
    ),
    'pendlePtGlpIsolationModeFactory.ownerSetIsTokenConverterTrusted(pendlePtGlpWrapperV2Address, true)',
  );
  await prettyPrintEncodedData(
    core.pendleEcosystem!.glpMar2024.dPtGlp2024.populateTransaction.ownerSetIsTokenConverterTrusted(
      '0x5bc9F119BfF9fB92Ecc276C19C00099dcF102040',
      false,
    ),
    'pendlePtGlpIsolationModeFactory.ownerSetIsTokenConverterTrusted(pendlePtGlpUnwrapperV2Old, false)',
  );
  await prettyPrintEncodedData(
    core.pendleEcosystem!.glpMar2024.dPtGlp2024.populateTransaction.ownerSetIsTokenConverterTrusted(
      '0xD84B2e74edd01940F36a23B4aCF0DA58aD28D3Ed',
      false,
    ),
    'pendlePtGlpIsolationModeFactory.ownerSetIsTokenConverterTrusted(pendlePtGlpWrapperV2Old, false)',
  );
  await prettyPrintEncodedData(
    core.pendleEcosystem!.glpMar2024.dPtGlp2024.populateTransaction.ownerSetPendlePtGLP2024Registry(
      pendleRegistry.address,
    ),
    'pendlePtGlpIsolationModeFactory.ownerSetPendleGLPRegistry(pendleRegistry)',
  );
  await prettyPrintEncodedData(
    core.pendleEcosystem!.glpMar2024.dPtGlp2024.populateTransaction.ownerSetUserVaultImplementation(
      pendlePtGlpTokenVaultAddress,
    ),
    'pendlePtGlpIsolationModeFactory.ownerSetUserVaultImplementation(pendlePtGlpTokenVaultAddress)',
  );
  await prettyPrintEncodedData(
    core.dolomiteMargin.populateTransaction.ownerSetPriceOracle(core.marketIds.dPtGlp!, pendlePtGlpPriceOracleAddress),
    'dolomiteMargin.ownerSetPriceOracle(dPtGlp, pendlePtGlpPriceOracleAddress)',
  );
}

async function encodePlvGLPTransactions(
  core: CoreProtocol,
  plutusVaultRegistry: IPlutusVaultRegistry,
  plvGlpTokenVaultAddress: string,
  plvGlpUnwrapperV2Address: string,
  plvGlpWrapperV2Address: string,
  plvGlpPriceOracleAddress: string,
) {
  await prettyPrintEncodedData(
    core.liquidatorAssetRegistry.populateTransaction.ownerRemoveLiquidatorFromAssetWhitelist(
      core.marketIds.dplvGlp!,
      oldLiquidatorAddress,
    ),
    'liquidatorAssetRegistry.ownerRemoveLiquidatorFromAssetWhitelist(dplvGlp, oldLiquidator)',
  );
  await prettyPrintEncodedData(
    core.liquidatorAssetRegistry.populateTransaction.ownerAddLiquidatorToAssetWhitelist(
      core.marketIds.dplvGlp!,
      core.liquidatorProxyV4.address,
    ),
    'liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(dplvGlp, newLiquidator)',
  );
  await prettyPrintEncodedData(
    core.plutusEcosystem!.live.plvGlpIsolationModeFactory.populateTransaction.ownerSetIsTokenConverterTrusted(
      plvGlpUnwrapperV2Address,
      true,
    ),
    'plvGlpIsolationModeFactory.ownerSetIsTokenConverterTrusted(plvGlpUnwrapperV2Address, true)',
  );
  await prettyPrintEncodedData(
    core.plutusEcosystem!.live.plvGlpIsolationModeFactory.populateTransaction.ownerSetIsTokenConverterTrusted(
      plvGlpWrapperV2Address,
      true,
    ),
    'plvGlpIsolationModeFactory.ownerSetIsTokenConverterTrusted(plvGlpWrapperV2Address, true)',
  );
  await prettyPrintEncodedData(
    core.plutusEcosystem!.live.plvGlpIsolationModeFactory.populateTransaction.ownerSetIsTokenConverterTrusted(
      '0xaA3E63b1F38Dc4d7682Cb34CBd0F4e1fCad57B69',
      false,
    ),
    'plvGlpIsolationModeFactory.ownerSetIsTokenConverterTrusted(plvGlpUnwrapperV2Old, false)',
  );
  await prettyPrintEncodedData(
    core.plutusEcosystem!.live.plvGlpIsolationModeFactory.populateTransaction.ownerSetIsTokenConverterTrusted(
      '0x850198296190ebDB80CE22A66DdC99F08633A7a1',
      false,
    ),
    'plvGlpIsolationModeFactory.ownerSetIsTokenConverterTrusted(plvGlpWrapperV2Old, false)',
  );
  await prettyPrintEncodedData(
    core.plutusEcosystem!.live.plvGlpIsolationModeFactory.populateTransaction.ownerSetPlutusVaultRegistry(
      plutusVaultRegistry.address,
    ),
    'plvGlpIsolationModeFactory.ownerSetPlutusVaultRegistry(plutusVaultRegistry)',
  );
  await prettyPrintEncodedData(
    core.plutusEcosystem!.live.plvGlpIsolationModeFactory.populateTransaction.ownerSetUserVaultImplementation(
      plvGlpTokenVaultAddress,
    ),
    'plvGlpIsolationModeFactory.ownerSetUserVaultImplementation(plvGlpTokenVaultAddress)',
  );
  await prettyPrintEncodedData(
    core.dolomiteMargin.populateTransaction.ownerSetPriceOracle(core.marketIds.dplvGlp!, plvGlpPriceOracleAddress),
    'dolomiteMargin.ownerSetPriceOracle(dplvGlp, plvGlpPriceOracleAddress)',
  );
  await prettyPrintEncodedData(
    core.plutusEcosystem!.live.dolomiteWhitelistForGlpDepositor.populateTransaction.ownerSetPlvGlpUnwrapperTrader(
      plvGlpUnwrapperV2Address,
    ),
    'dolomiteWhitelistForGlpDepositor.ownerSetPlvGlpUnwrapperTrader(plvGlpUnwrapperV2)',
  );
  await prettyPrintEncodedData(
    core.plutusEcosystem!.live.dolomiteWhitelistForGlpDepositor.populateTransaction.ownerSetPlvGlpWrapperTrader(
      plvGlpWrapperV2Address,
    ),
    'dolomiteWhitelistForGlpDepositor.ownerSetPlvGlpWrapperTrader(plvGlpWrapperV2)',
  );
  await prettyPrintEncodedData(
    core.plutusEcosystem!.live.dolomiteWhitelistForPlutusChef.populateTransaction.ownerSetPlvGlpUnwrapperTrader(
      plvGlpUnwrapperV2Address,
    ),
    'dolomiteWhitelistForPlutusChef.ownerSetPlvGlpUnwrapperTrader(plvGlpUnwrapperV2)',
  );
  await prettyPrintEncodedData(
    core.plutusEcosystem!.live.dolomiteWhitelistForPlutusChef.populateTransaction.ownerSetPlvGlpWrapperTrader(
      plvGlpWrapperV2Address,
    ),
    'dolomiteWhitelistForPlutusChef.ownerSetPlvGlpWrapperTrader(plvGlpWrapperV2)',
  );
}

async function main() {
  const network = (await ethers.provider.getNetwork()).chainId.toString() as Network;
  const core = await setupCoreProtocol(getDefaultCoreProtocolConfig(network));

  const {
    gmxRegistry,
    glpTokenVaultAddress,
    glpUnwrapperV2Address,
    glpWrapperV2Address,
    glpPriceOracleAddress,
  } = await deployGmxContracts(network, core);

  const {
    jonesUsdcRegistry,
    jUSDCTokenVaultAddress,
    jUSDCUnwrapperV2ForLiquidationAddress,
    jUSDCUnwrapperV2ForZapAddress,
    jUSDCWrapperV2Address,
    jUSDCPriceOracleAddress,
  } = await deployJonesUSDCContracts(network, core);

  const {
    pendleRegistry,
    pendlePtGlpTokenVaultAddress,
    pendlePtGlpUnwrapperV2Address,
    pendlePtGlpWrapperV2Address,
    pendlePtGlpPriceOracleAddress,
  } = await deployPendleGLPContracts(network, core);

  const {
    plutusVaultRegistry,
    plvGlpTokenVaultAddress,
    plvGlpUnwrapperV2Address,
    plvGlpWrapperV2Address,
    plvGlpPriceOracleAddress,
  } = await deployPlutusVaultGLPContracts(network, core);

  // stopped at 33
  const dolomiteRegistryProxy = RegistryProxy__factory.connect(core.dolomiteRegistry.address, core.hhUser1);
  const dolomiteRegistryImplementationAddress = await deployContractAndSave(
    Number(network),
    'DolomiteRegistryImplementation',
    [],
    'DolomiteRegistryImplementationV2',
  );

  await prettyPrintEncodedData(
    dolomiteRegistryProxy.populateTransaction.upgradeTo(dolomiteRegistryImplementationAddress),
    'dolomiteRegistryProxy.upgradeTo(dolomiteRegistryImplementationAddress)',
  );
  await prettyPrintEncodedData(
    core.dolomiteRegistry.populateTransaction.ownerSetSlippageToleranceForPauseSentinel('70000000000000000'),
    'dolomiteRegistryProxy.ownerSetSlippageToleranceForPauseSentinel(70000000000000000)',
  );
  await prettyPrintEncodedData(
    core.dolomiteMargin.populateTransaction.ownerSetGlobalOperator(oldLiquidatorAddress, false),
    'dolomiteMargin.ownerSetGlobalOperator(oldLiquidatorAddress, false)',
  );
  await prettyPrintEncodedData(
    core.dolomiteMargin.populateTransaction.ownerSetGlobalOperator(core.genericTraderProxy!.address, true),
    'dolomiteMargin.ownerSetGlobalOperator(genericTraderProxy.address, true)',
  );
  await prettyPrintEncodedData(
    core.dolomiteMargin.populateTransaction.ownerSetGlobalOperator(core.liquidatorProxyV4!.address, true),
    'dolomiteMargin.ownerSetGlobalOperator(liquidatorProxyV4.address, true)',
  );

  await encodeGmxTransactions(
    core,
    gmxRegistry,
    glpTokenVaultAddress,
    glpUnwrapperV2Address,
    glpWrapperV2Address,
    glpPriceOracleAddress,
  );

  await encodeJonesUSDCTransactions(
    core,
    jonesUsdcRegistry,
    jUSDCTokenVaultAddress,
    jUSDCUnwrapperV2ForLiquidationAddress,
    jUSDCUnwrapperV2ForZapAddress,
    jUSDCWrapperV2Address,
    jUSDCPriceOracleAddress,
  );

  await encodePendleGLPTransactions(
    core,
    pendleRegistry,
    pendlePtGlpTokenVaultAddress,
    pendlePtGlpUnwrapperV2Address,
    pendlePtGlpWrapperV2Address,
    pendlePtGlpPriceOracleAddress,
  );

  await encodePlvGLPTransactions(
    core,
    plutusVaultRegistry,
    plvGlpTokenVaultAddress,
    plvGlpUnwrapperV2Address,
    plvGlpWrapperV2Address,
    plvGlpPriceOracleAddress,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
