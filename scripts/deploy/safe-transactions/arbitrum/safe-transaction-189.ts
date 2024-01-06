import { PlutusVaultGLPIsolationModeUnwrapperTraderV2__factory } from '../../../../src/types';
import {
  getARBUnwrapperTraderV2ConstructorParams,
  getARBWrapperTraderV2ConstructorParams,
} from '../../../../src/utils/constructors/arb';
import {
  getGLPIsolationModeUnwrapperTraderV2ConstructorParams,
  getGLPIsolationModeWrapperTraderV2ConstructorParams,
  getGMXUnwrapperTraderV2ConstructorParams,
  getGMXWrapperTraderV2ConstructorParams,
} from '../../../../src/utils/constructors/gmx';
import {
  getJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidationConstructorParams,
  getJonesUSDCIsolationModeUnwrapperTraderV2ForZapConstructorParams,
  getJonesUSDCIsolationModeWrapperTraderV2ConstructorParams,
} from '../../../../src/utils/constructors/jones';
import {
  getPendlePtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams,
  getPendlePtGLP2024IsolationModeWrapperTraderV2ConstructorParams,
  getPendlePtIsolationModeUnwrapperTraderV2ConstructorParams, getPendlePtIsolationModeWrapperTraderV2ConstructorParams,
  getPendleYtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams,
  getPendleYtGLP2024IsolationModeWrapperTraderV2ConstructorParams,
} from '../../../../src/utils/constructors/pendle';
import {
  getPlutusVaultGLPIsolationModeUnwrapperTraderV2ConstructorParams,
  getPlutusVaultGLPIsolationModeWrapperTraderV2ConstructorParams,
  getPlutusVaultGLPWithChainlinkAutomationPriceOracleConstructorParams,
} from '../../../../src/utils/constructors/plutus';
import { getAndCheckSpecificNetwork } from '../../../../src/utils/dolomite-utils';
import { Network } from '../../../../src/utils/no-deps-constants';
import { CoreProtocol, setupCoreProtocol } from '../../../../test/utils/setup';
import {
  createFolder,
  DenJsonUpload,
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
  writeFile,
} from '../../../deploy-utils';
import Deployments from '../../../deployments.json';

async function deployGlpUpdates(core: CoreProtocol): Promise<EncodedTransaction[]> {
  const unwrapperV3 = await deployContractAndSave(
    core.config.networkNumber,
    'GLPIsolationModeUnwrapperTraderV2',
    getGLPIsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      core.gmxEcosystem!.live.dGlp,
      core.gmxEcosystem!.live.gmxRegistry,
    ),
    'GLPIsolationModeUnwrapperTraderV3',
  );
  const wrapperV3 = await deployContractAndSave(
    core.config.networkNumber,
    'GLPIsolationModeWrapperTraderV2',
    getGLPIsolationModeWrapperTraderV2ConstructorParams(
      core,
      core.gmxEcosystem!.live.dGlp,
      core.gmxEcosystem!.live.gmxRegistry,
    ),
    'GLPIsolationModeWrapperTraderV3',
  );
  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem!.live,
      'dGlp',
      'setIsTokenConverterTrusted',
      [Deployments.GLPIsolationModeUnwrapperTraderV3['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem!.live,
      'dGlp',
      'setIsTokenConverterTrusted',
      [Deployments.GLPIsolationModeWrapperTraderV3['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem!.live,
      'dGlp',
      'setIsTokenConverterTrusted',
      [unwrapperV3, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem!.live,
      'dGlp',
      'setIsTokenConverterTrusted',
      [wrapperV3, true],
    ),
  );
  return transactions;
}

async function deployPlutusVaultGlpUpdates(core: CoreProtocol): Promise<EncodedTransaction[]> {
  const unwrapperV3 = await deployContractAndSave(
    core.config.networkNumber,
    'PlutusVaultGLPIsolationModeUnwrapperTraderV2',
    getPlutusVaultGLPIsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      core.plutusEcosystem!.live.plutusVaultRegistry,
      core.plutusEcosystem!.live.plvGlpIsolationModeFactory,
    ),
    'PlutusVaultGLPIsolationModeUnwrapperTraderV3',
  );
  const wrapperV3 = await deployContractAndSave(
    core.config.networkNumber,
    'PlutusVaultGLPIsolationModeWrapperTraderV2',
    getPlutusVaultGLPIsolationModeWrapperTraderV2ConstructorParams(
      core,
      core.plutusEcosystem!.live.plutusVaultRegistry,
      core.plutusEcosystem!.live.plvGlpIsolationModeFactory,
    ),
    'PlutusVaultGLPIsolationModeWrapperTraderV3',
  );
  const oracle = await deployContractAndSave(
    core.config.networkNumber,
    'PlutusVaultGLPWithChainlinkAutomationPriceOracle',
    getPlutusVaultGLPWithChainlinkAutomationPriceOracleConstructorParams(
      core,
      core.plutusEcosystem!.live.plutusVaultRegistry,
      core.plutusEcosystem!.live.plvGlpIsolationModeFactory,
      PlutusVaultGLPIsolationModeUnwrapperTraderV2__factory.connect(unwrapperV3, core.hhUser1),
    ),
    'PlutusVaultGLPWithChainlinkAutomationPriceOracleV2'
  );

  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.plutusEcosystem!.live,
      'plvGlpIsolationModeFactory',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.PlutusVaultGLPIsolationModeUnwrapperTraderV2['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.plutusEcosystem!.live,
      'plvGlpIsolationModeFactory',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.PlutusVaultGLPIsolationModeWrapperTraderV2['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.plutusEcosystem!.live,
      'plvGlpIsolationModeFactory',
      'ownerSetIsTokenConverterTrusted',
      [unwrapperV3, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.plutusEcosystem!.live,
      'dolomiteWhitelistForPlutusChef',
      'ownerSetPlvGlpUnwrapperTrader',
      [unwrapperV3],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.plutusEcosystem!.live,
      'dolomiteWhitelistForPlutusChef',
      'ownerSetPlvGlpWrapperTrader',
      [wrapperV3],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.plutusEcosystem!.live,
      'dolomiteWhitelistForGlpDepositor',
      'ownerSetPlvGlpUnwrapperTrader',
      [unwrapperV3],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.plutusEcosystem!.live,
      'dolomiteWhitelistForGlpDepositor',
      'ownerSetPlvGlpWrapperTrader',
      [wrapperV3],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetPriceOracle',
      [core.marketIds.dplvGlp!, oracle],
    ),
  );
  return transactions;
}

async function deployJUsdcUpdates(core: CoreProtocol): Promise<EncodedTransaction[]> {
  const unwrapperV3ForLiquidation = await deployContractAndSave(
    core.config.networkNumber,
    'JonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation',
    getJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidationConstructorParams(
      core,
      core.jonesEcosystem!.live.jonesUSDCRegistry,
      core.jonesEcosystem!.live.jUSDCIsolationModeFactory,
    ),
    'JonesUSDCIsolationModeUnwrapperTraderV3ForLiquidation',
  );
  const unwrapperV3 = await deployContractAndSave(
    core.config.networkNumber,
    'JonesUSDCIsolationModeUnwrapperTraderV2',
    getJonesUSDCIsolationModeUnwrapperTraderV2ForZapConstructorParams(
      core,
      core.jonesEcosystem!.live.jonesUSDCRegistry,
      core.jonesEcosystem!.live.jUSDCIsolationModeFactory,
    ),
    'JonesUSDCIsolationModeUnwrapperTraderV3',
  );
  const wrapperV3 = await deployContractAndSave(
    core.config.networkNumber,
    'JonesUSDCIsolationModeWrapperTraderV2',
    getJonesUSDCIsolationModeWrapperTraderV2ConstructorParams(
      core,
      core.jonesEcosystem!.live.jonesUSDCRegistry,
      core.jonesEcosystem!.live.jUSDCIsolationModeFactory,
    ),
    'JonesUSDCIsolationModeWrapperTraderV3',
  );
  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.jonesEcosystem!.live,
      'jUSDCIsolationModeFactory',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.JonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.jonesEcosystem!.live,
      'jUSDCIsolationModeFactory',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.JonesUSDCIsolationModeUnwrapperTraderV2['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.jonesEcosystem!.live,
      'jUSDCIsolationModeFactory',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.JonesUSDCIsolationModeWrapperTraderV2['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.jonesEcosystem!.live,
      'jUSDCIsolationModeFactory',
      'ownerSetIsTokenConverterTrusted',
      [unwrapperV3ForLiquidation, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.jonesEcosystem!.live,
      'jUSDCIsolationModeFactory',
      'ownerSetIsTokenConverterTrusted',
      [unwrapperV3, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.jonesEcosystem!.live,
      'jUSDCIsolationModeFactory',
      'ownerSetIsTokenConverterTrusted',
      [wrapperV3, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.jonesEcosystem!.live,
      'jonesUSDCRegistry',
      'ownerSetUnwrapperTraderForLiquidation',
      [unwrapperV3ForLiquidation],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.jonesEcosystem!.live,
      'jonesUSDCRegistry',
      'ownerSetUnwrapperTraderForZap',
      [unwrapperV3],
    ),
  );
  return transactions;
}

async function deployPtGlpUpdates(core: CoreProtocol): Promise<EncodedTransaction[]> {
  const unwrapperV3 = await deployContractAndSave(
    core.config.networkNumber,
    'PendlePtGLP2024IsolationModeUnwrapperTraderV2',
    getPendlePtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem!.glpMar2024.dPtGlp2024,
      core.pendleEcosystem!.glpMar2024.pendleRegistry,
    ),
    'PendlePtGLP2024IsolationModeUnwrapperTraderV3',
  );
  const wrapperV3 = await deployContractAndSave(
    core.config.networkNumber,
    'PendlePtGLP2024IsolationModeWrapperTraderV2',
    getPendlePtGLP2024IsolationModeWrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem!.glpMar2024.dPtGlp2024,
      core.pendleEcosystem!.glpMar2024.pendleRegistry,
    ),
    'PendlePtGLP2024IsolationModeWrapperTraderV3',
  );
  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.glpMar2024,
      'dPtGlp2024',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.PendlePtGLP2024IsolationModeUnwrapperTraderV2['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.glpMar2024,
      'dPtGlp2024',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.PendlePtGLP2024IsolationModeWrapperTraderV2['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.glpMar2024,
      'dPtGlp2024',
      'ownerSetIsTokenConverterTrusted',
      [unwrapperV3, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.glpMar2024,
      'dPtGlp2024',
      'ownerSetIsTokenConverterTrusted',
      [wrapperV3, true],
    ),
  );
  return transactions;
}

async function deployYtGlpUpdates(core: CoreProtocol): Promise<EncodedTransaction[]> {
  const unwrapperV3 = await deployContractAndSave(
    core.config.networkNumber,
    'PendleYtGLP2024IsolationModeUnwrapperTraderV2',
    getPendleYtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem!.glpMar2024.dYtGlp2024,
      core.pendleEcosystem!.glpMar2024.pendleRegistry,
    ),
    'PendleYtGLP2024IsolationModeUnwrapperTraderV3',
  );
  const wrapperV3 = await deployContractAndSave(
    core.config.networkNumber,
    'PendleYtGLP2024IsolationModeWrapperTraderV2',
    getPendleYtGLP2024IsolationModeWrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem!.glpMar2024.dYtGlp2024,
      core.pendleEcosystem!.glpMar2024.pendleRegistry,
    ),
    'PendleYtGLP2024IsolationModeWrapperTraderV3',
  );
  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.glpMar2024,
      'dYtGlp2024',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.PendleYtGLP2024IsolationModeUnwrapperTraderV2['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.glpMar2024,
      'dYtGlp2024',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.PendleYtGLP2024IsolationModeWrapperTraderV2['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.glpMar2024,
      'dYtGlp2024',
      'ownerSetIsTokenConverterTrusted',
      [unwrapperV3, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.glpMar2024,
      'dYtGlp2024',
      'ownerSetIsTokenConverterTrusted',
      [wrapperV3, true],
    ),
  );
  return transactions;
}

async function deployPtREthUpdates(core: CoreProtocol): Promise<EncodedTransaction[]> {
  const unwrapperV3 = await deployContractAndSave(
    core.config.networkNumber,
    'PendlePtIsolationModeUnwrapperTraderV2',
    getPendlePtIsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem!.rEthJun2025.pendleRegistry,
      core.tokens.rEth!,
      core.pendleEcosystem!.rEthJun2025.dPtREthJun2025,
    ),
    'PendlePtREthJun2025IsolationModeUnwrapperTraderV3',
  );
  const wrapperV3 = await deployContractAndSave(
    core.config.networkNumber,
    'PendlePtIsolationModeWrapperTraderV2',
    getPendlePtIsolationModeWrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem!.rEthJun2025.pendleRegistry,
      core.tokens.rEth!,
      core.pendleEcosystem!.rEthJun2025.dPtREthJun2025,
    ),
    'PendlePtREthJun2025IsolationModeWrapperTraderV3',
  );
  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.rEthJun2025,
      'dPtREthJun2025',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.PendlePtREthJun2025IsolationModeUnwrapperTraderV2['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.rEthJun2025,
      'dPtREthJun2025',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.PendlePtREthJun2025IsolationModeWrapperTraderV2['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.rEthJun2025,
      'dPtREthJun2025',
      'ownerSetIsTokenConverterTrusted',
      [unwrapperV3, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.rEthJun2025,
      'dPtREthJun2025',
      'ownerSetIsTokenConverterTrusted',
      [wrapperV3, true],
    ),
  );
  return transactions;
}

async function deployPtWstEthJun2024Updates(core: CoreProtocol): Promise<EncodedTransaction[]> {
  const unwrapperV3 = await deployContractAndSave(
    core.config.networkNumber,
    'PendlePtIsolationModeUnwrapperTraderV2',
    getPendlePtIsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem!.wstEthJun2024.pendleRegistry,
      core.tokens.rEth!,
      core.pendleEcosystem!.wstEthJun2024.dPtWstEthJun2024,
    ),
    'PendlePtWstEthJun2024IsolationModeUnwrapperTraderV3',
  );
  const wrapperV3 = await deployContractAndSave(
    core.config.networkNumber,
    'PendlePtIsolationModeWrapperTraderV2',
    getPendlePtIsolationModeWrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem!.wstEthJun2024.pendleRegistry,
      core.tokens.rEth!,
      core.pendleEcosystem!.wstEthJun2024.dPtWstEthJun2024,
    ),
    'PendlePtWstEthJun2024IsolationModeWrapperTraderV3',
  );
  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.wstEthJun2024,
      'dPtWstEthJun2024',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.PendlePtWstEthJun2024IsolationModeUnwrapperTraderV2['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.wstEthJun2024,
      'dPtWstEthJun2024',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.PendlePtWstEthJun2024IsolationModeWrapperTraderV2['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.wstEthJun2024,
      'dPtWstEthJun2024',
      'ownerSetIsTokenConverterTrusted',
      [unwrapperV3, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.wstEthJun2024,
      'dPtWstEthJun2024',
      'ownerSetIsTokenConverterTrusted',
      [wrapperV3, true],
    ),
  );
  return transactions;
}

async function deployPtWstEthJun2025Updates(core: CoreProtocol): Promise<EncodedTransaction[]> {
  const unwrapperV3 = await deployContractAndSave(
    core.config.networkNumber,
    'PendlePtIsolationModeUnwrapperTraderV2',
    getPendlePtIsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem!.wstEthJun2025.pendleRegistry,
      core.tokens.rEth!,
      core.pendleEcosystem!.wstEthJun2025.dPtWstEthJun2025,
    ),
    'PendlePtWstEthJun2025IsolationModeUnwrapperTraderV3',
  );
  const wrapperV3 = await deployContractAndSave(
    core.config.networkNumber,
    'PendlePtIsolationModeWrapperTraderV2',
    getPendlePtIsolationModeWrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem!.wstEthJun2025.pendleRegistry,
      core.tokens.rEth!,
      core.pendleEcosystem!.wstEthJun2025.dPtWstEthJun2025,
    ),
    'PendlePtWstEthJun2025IsolationModeWrapperTraderV3',
  );
  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.wstEthJun2025,
      'dPtWstEthJun2025',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.PendlePtWstEthJun2025IsolationModeUnwrapperTraderV2['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.wstEthJun2025,
      'dPtWstEthJun2025',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.PendlePtWstEthJun2025IsolationModeWrapperTraderV2['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.wstEthJun2025,
      'dPtWstEthJun2025',
      'ownerSetIsTokenConverterTrusted',
      [unwrapperV3, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.wstEthJun2025,
      'dPtWstEthJun2025',
      'ownerSetIsTokenConverterTrusted',
      [wrapperV3, true],
    ),
  );
  return transactions;
}

async function deployVARBUpdates(core: CoreProtocol): Promise<EncodedTransaction[]> {
  const unwrapperV3 = await deployContractAndSave(
    core.config.networkNumber,
    'SimpleIsolationModeUnwrapperTraderV2',
    getARBUnwrapperTraderV2ConstructorParams(
      core.arbEcosystem!.live.dArb,
      core,
    ),
    'ARBIsolationModeUnwrapperTraderV3',
  );
  const wrapperV3 = await deployContractAndSave(
    core.config.networkNumber,
    'SimpleIsolationModeWrapperTraderV2',
    getARBWrapperTraderV2ConstructorParams(
      core.arbEcosystem!.live.dArb,
      core,
    ),
    'ARBIsolationModeWrapperTraderV3',
  );
  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.arbEcosystem!.live,
      'dArb',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.ARBIsolationModeUnwrapperTraderV2['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.arbEcosystem!.live,
      'dArb',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.ARBIsolationModeWrapperTraderV2['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.arbEcosystem!.live,
      'dArb',
      'ownerSetIsTokenConverterTrusted',
      [unwrapperV3, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.arbEcosystem!.live,
      'dArb',
      'ownerSetIsTokenConverterTrusted',
      [wrapperV3, true],
    ),
  );
  return transactions;
}

async function deployStakedGmxUpdates(core: CoreProtocol): Promise<EncodedTransaction[]> {
  const unwrapperV3 = await deployContractAndSave(
    core.config.networkNumber,
    'SimpleIsolationModeUnwrapperTraderV2',
    getGMXUnwrapperTraderV2ConstructorParams(
      core.gmxEcosystem!.live.dGmx,
      core,
    ),
    'GMXIsolationModeUnwrapperTraderV3',
  );
  const wrapperV3 = await deployContractAndSave(
    core.config.networkNumber,
    'SimpleIsolationModeWrapperTraderV2',
    getGMXWrapperTraderV2ConstructorParams(
      core.gmxEcosystem!.live.dGmx,
      core,
    ),
    'GMXIsolationModeWrapperTraderV3',
  );
  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem!.live,
      'dGmx',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.GMXIsolationModeUnwrapperTraderV2['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem!.live,
      'dGmx',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.GMXIsolationModeWrapperTraderV2['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem!.live,
      'dGmx',
      'ownerSetIsTokenConverterTrusted',
      [unwrapperV3, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem!.live,
      'dGmx',
      'ownerSetIsTokenConverterTrusted',
      [wrapperV3, true],
    ),
  );
  return transactions;
}

/**
 * This script encodes the following transactions:
 * - Sets the liquidatorAssetRegistry on the DolomiteRegistry
 * - Deploys new unwrapper / wrappers for each Isolation Mode asset
 * - Sets the new wrappers/unwrappers for each isolation mode asset on the corresponding factories + registries
 */
async function main(): Promise<DenJsonUpload> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteRegistry',
      'ownerSetLiquidatorAssetRegistry',
      [core.liquidatorAssetRegistry.address],
    ),
    ...await deployGlpUpdates(core),
    ...await deployPlutusVaultGlpUpdates(core),
    ...await deployJUsdcUpdates(core),
    ...await deployPtGlpUpdates(core),
    ...await deployYtGlpUpdates(core),
    ...await deployPtREthUpdates(core),
    ...await deployPtWstEthJun2024Updates(core),
    ...await deployPtWstEthJun2025Updates(core),
    ...await deployVARBUpdates(core),
    ...await deployStakedGmxUpdates(core),
  ];

  return {
    transactions,
    chainId: network,
  };
}

main()
  .then(jsonUpload => {
    if (typeof jsonUpload === 'undefined') {
      return;
    }

    const path = require('path');
    const scriptName = path.basename(__filename).slice(0, -3);
    const dir = `${__dirname}/output`;
    createFolder(dir);
    writeFile(`${dir}/${scriptName}.json`, JSON.stringify(jsonUpload, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
