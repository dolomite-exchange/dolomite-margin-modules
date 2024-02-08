import {
  getARBUnwrapperTraderV2ConstructorParams,
  getARBWrapperTraderV2ConstructorParams,
} from '@dolomite-exchange/modules-arb/src/arb-constructors';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  getGLPIsolationModeUnwrapperTraderV2ConstructorParams,
  getGLPIsolationModeWrapperTraderV2ConstructorParams,
  getGMXUnwrapperTraderV2ConstructorParams,
  getGMXWrapperTraderV2ConstructorParams,
} from '@dolomite-exchange/modules-glp/src/glp-constructors';
import {
  getJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidationConstructorParams,
  getJonesUSDCIsolationModeUnwrapperTraderV2ForZapConstructorParams,
  getJonesUSDCIsolationModeWrapperTraderV2ConstructorParams,
} from '@dolomite-exchange/modules-jones/src/jones-construtors';
import {
  getPendlePtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams,
  getPendlePtGLP2024IsolationModeWrapperTraderV2ConstructorParams,
  getPendlePtIsolationModeUnwrapperTraderV2ConstructorParams,
  getPendlePtIsolationModeWrapperTraderV2ConstructorParams,
  getPendleYtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams,
  getPendleYtGLP2024IsolationModeWrapperTraderV2ConstructorParams,
} from '@dolomite-exchange/modules-pendle/src/pendle-constructors';
import {
  getPlutusVaultGLPIsolationModeUnwrapperTraderV2ConstructorParams,
  getPlutusVaultGLPIsolationModeWrapperTraderV2ConstructorParams,
  getPlutusVaultGLPWithChainlinkAutomationPriceOracleConstructorParams,
} from '@dolomite-exchange/modules-plutus/src/plutus-constructors';
import { PlutusVaultGLPIsolationModeUnwrapperTraderV2__factory } from '@dolomite-exchange/modules-plutus/src/types';
import Deployments from '@dolomite-exchange/modules-deployment/src/deploy/deployments.json';
import {
  createFolder,
  DenJsonUpload,
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
  writeFile,
} from '../../../utils/deploy-utils';

async function deployGlpUpdates(core: CoreProtocolArbitrumOne): Promise<EncodedTransaction[]> {
  const unwrapperV4 = await deployContractAndSave(
    'GLPIsolationModeUnwrapperTraderV2',
    getGLPIsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      core.gmxEcosystem!.live.dGlp,
      core.gmxEcosystem!.live.gmxRegistry,
    ),
    'GLPIsolationModeUnwrapperTraderV4',
  );
  const wrapperV4 = await deployContractAndSave(
    'GLPIsolationModeWrapperTraderV2',
    getGLPIsolationModeWrapperTraderV2ConstructorParams(
      core,
      core.gmxEcosystem!.live.dGlp,
      core.gmxEcosystem!.live.gmxRegistry,
    ),
    'GLPIsolationModeWrapperTraderV4',
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
      [unwrapperV4, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem!.live,
      'dGlp',
      'setIsTokenConverterTrusted',
      [wrapperV4, true],
    ),
  );
  return transactions;
}

async function deployPlutusVaultGlpUpdates(core: CoreProtocolArbitrumOne): Promise<EncodedTransaction[]> {
  const unwrapperV4 = await deployContractAndSave(
    'PlutusVaultGLPIsolationModeUnwrapperTraderV2',
    getPlutusVaultGLPIsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      core.plutusEcosystem!.live.plutusVaultRegistry,
      core.plutusEcosystem!.live.plvGlpIsolationModeFactory,
    ),
    'PlutusVaultGLPIsolationModeUnwrapperTraderV4',
  );
  const wrapperV4 = await deployContractAndSave(
    'PlutusVaultGLPIsolationModeWrapperTraderV2',
    getPlutusVaultGLPIsolationModeWrapperTraderV2ConstructorParams(
      core,
      core.plutusEcosystem!.live.plutusVaultRegistry,
      core.plutusEcosystem!.live.plvGlpIsolationModeFactory,
    ),
    'PlutusVaultGLPIsolationModeWrapperTraderV4',
  );
  const oracle = await deployContractAndSave(
    'PlutusVaultGLPWithChainlinkAutomationPriceOracle',
    getPlutusVaultGLPWithChainlinkAutomationPriceOracleConstructorParams(
      core,
      core.plutusEcosystem!.live.plutusVaultRegistry,
      core.plutusEcosystem!.live.plvGlpIsolationModeFactory,
      PlutusVaultGLPIsolationModeUnwrapperTraderV2__factory.connect(unwrapperV4, core.hhUser1),
    ),
    'PlutusVaultGLPWithChainlinkAutomationPriceOracleV3',
  );

  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.plutusEcosystem!.live,
      'plvGlpIsolationModeFactory',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.PlutusVaultGLPIsolationModeUnwrapperTraderV3['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.plutusEcosystem!.live,
      'plvGlpIsolationModeFactory',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.PlutusVaultGLPIsolationModeWrapperTraderV3['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.plutusEcosystem!.live,
      'plvGlpIsolationModeFactory',
      'ownerSetIsTokenConverterTrusted',
      [unwrapperV4, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.plutusEcosystem!.live,
      'plvGlpIsolationModeFactory',
      'ownerSetIsTokenConverterTrusted',
      [wrapperV4, true],
    ),
  );

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.plutusEcosystem!.live,
      'dolomiteWhitelistForPlutusChef',
      'ownerSetPlvGlpUnwrapperTrader',
      [unwrapperV4],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.plutusEcosystem!.live,
      'dolomiteWhitelistForPlutusChef',
      'ownerSetPlvGlpWrapperTrader',
      [wrapperV4],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.plutusEcosystem!.live,
      'dolomiteWhitelistForGlpDepositor',
      'ownerSetPlvGlpUnwrapperTrader',
      [unwrapperV4],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.plutusEcosystem!.live,
      'dolomiteWhitelistForGlpDepositor',
      'ownerSetPlvGlpWrapperTrader',
      [wrapperV4],
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

async function deployJUsdcUpdates(core: CoreProtocolArbitrumOne): Promise<EncodedTransaction[]> {
  const unwrapperV4ForLiquidation = await deployContractAndSave(
    'JonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation',
    getJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidationConstructorParams(
      core,
      core.jonesEcosystem!.live.jonesUSDCRegistry,
      core.jonesEcosystem!.live.jUSDCIsolationModeFactory,
    ),
    'JonesUSDCIsolationModeUnwrapperTraderV4ForLiquidation',
  );
  const unwrapperV4 = await deployContractAndSave(
    'JonesUSDCIsolationModeUnwrapperTraderV2',
    getJonesUSDCIsolationModeUnwrapperTraderV2ForZapConstructorParams(
      core,
      core.jonesEcosystem!.live.jonesUSDCRegistry,
      core.jonesEcosystem!.live.jUSDCIsolationModeFactory,
    ),
    'JonesUSDCIsolationModeUnwrapperTraderV4',
  );
  const wrapperV4 = await deployContractAndSave(
    'JonesUSDCIsolationModeWrapperTraderV2',
    getJonesUSDCIsolationModeWrapperTraderV2ConstructorParams(
      core,
      core.jonesEcosystem!.live.jonesUSDCRegistry,
      core.jonesEcosystem!.live.jUSDCIsolationModeFactory,
    ),
    'JonesUSDCIsolationModeWrapperTraderV4',
  );
  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.jonesEcosystem!.live,
      'jUSDCIsolationModeFactory',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.JonesUSDCIsolationModeUnwrapperTraderV3ForLiquidation['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.jonesEcosystem!.live,
      'jUSDCIsolationModeFactory',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.JonesUSDCIsolationModeUnwrapperTraderV3['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.jonesEcosystem!.live,
      'jUSDCIsolationModeFactory',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.JonesUSDCIsolationModeWrapperTraderV3['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.jonesEcosystem!.live,
      'jUSDCIsolationModeFactory',
      'ownerSetIsTokenConverterTrusted',
      [unwrapperV4ForLiquidation, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.jonesEcosystem!.live,
      'jUSDCIsolationModeFactory',
      'ownerSetIsTokenConverterTrusted',
      [unwrapperV4, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.jonesEcosystem!.live,
      'jUSDCIsolationModeFactory',
      'ownerSetIsTokenConverterTrusted',
      [wrapperV4, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.jonesEcosystem!.live,
      'jonesUSDCRegistry',
      'ownerSetUnwrapperTraderForLiquidation',
      [unwrapperV4ForLiquidation],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.jonesEcosystem!.live,
      'jonesUSDCRegistry',
      'ownerSetUnwrapperTraderForZap',
      [unwrapperV4],
    ),
  );
  return transactions;
}

async function deployPtGlpUpdates(core: CoreProtocolArbitrumOne): Promise<EncodedTransaction[]> {
  const unwrapperV4 = await deployContractAndSave(
    'PendlePtGLP2024IsolationModeUnwrapperTraderV2',
    getPendlePtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem!.glpMar2024.dPtGlp2024,
      core.pendleEcosystem!.glpMar2024.pendleRegistry,
    ),
    'PendlePtGLP2024IsolationModeUnwrapperTraderV4',
  );
  const wrapperV4 = await deployContractAndSave(
    'PendlePtGLP2024IsolationModeWrapperTraderV2',
    getPendlePtGLP2024IsolationModeWrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem!.glpMar2024.dPtGlp2024,
      core.pendleEcosystem!.glpMar2024.pendleRegistry,
    ),
    'PendlePtGLP2024IsolationModeWrapperTraderV4',
  );
  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.glpMar2024,
      'dPtGlp2024',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.PendlePtGLP2024IsolationModeUnwrapperTraderV3['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.glpMar2024,
      'dPtGlp2024',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.PendlePtGLP2024IsolationModeWrapperTraderV3['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.glpMar2024,
      'dPtGlp2024',
      'ownerSetIsTokenConverterTrusted',
      [unwrapperV4, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.glpMar2024,
      'dPtGlp2024',
      'ownerSetIsTokenConverterTrusted',
      [wrapperV4, true],
    ),
  );
  return transactions;
}

async function deployYtGlpUpdates(core: CoreProtocolArbitrumOne): Promise<EncodedTransaction[]> {
  const unwrapperV4 = await deployContractAndSave(
    'PendleYtGLP2024IsolationModeUnwrapperTraderV2',
    getPendleYtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem!.glpMar2024.dYtGlp2024,
      core.pendleEcosystem!.glpMar2024.pendleRegistry,
    ),
    'PendleYtGLP2024IsolationModeUnwrapperTraderV4',
  );
  const wrapperV4 = await deployContractAndSave(
    'PendleYtGLP2024IsolationModeWrapperTraderV2',
    getPendleYtGLP2024IsolationModeWrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem!.glpMar2024.dYtGlp2024,
      core.pendleEcosystem!.glpMar2024.pendleRegistry,
    ),
    'PendleYtGLP2024IsolationModeWrapperTraderV4',
  );
  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.glpMar2024,
      'dYtGlp2024',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.PendleYtGLP2024IsolationModeUnwrapperTraderV3['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.glpMar2024,
      'dYtGlp2024',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.PendleYtGLP2024IsolationModeWrapperTraderV3['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.glpMar2024,
      'dYtGlp2024',
      'ownerSetIsTokenConverterTrusted',
      [unwrapperV4, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.glpMar2024,
      'dYtGlp2024',
      'ownerSetIsTokenConverterTrusted',
      [wrapperV4, true],
    ),
  );
  return transactions;
}

async function deployPtREthUpdates(core: CoreProtocolArbitrumOne): Promise<EncodedTransaction[]> {
  const unwrapperV4 = await deployContractAndSave(
    'PendlePtIsolationModeUnwrapperTraderV2',
    getPendlePtIsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem!.rEthJun2025.pendleRegistry,
      core.tokens.rEth!,
      core.pendleEcosystem!.rEthJun2025.dPtREthJun2025,
    ),
    'PendlePtREthJun2025IsolationModeUnwrapperTraderV4',
  );
  const wrapperV4 = await deployContractAndSave(
    'PendlePtIsolationModeWrapperTraderV2',
    getPendlePtIsolationModeWrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem!.rEthJun2025.pendleRegistry,
      core.tokens.rEth!,
      core.pendleEcosystem!.rEthJun2025.dPtREthJun2025,
    ),
    'PendlePtREthJun2025IsolationModeWrapperTraderV4',
  );
  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.rEthJun2025,
      'dPtREthJun2025',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.PendlePtREthJun2025IsolationModeUnwrapperTraderV3['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.rEthJun2025,
      'dPtREthJun2025',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.PendlePtREthJun2025IsolationModeWrapperTraderV3['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.rEthJun2025,
      'dPtREthJun2025',
      'ownerSetIsTokenConverterTrusted',
      [unwrapperV4, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.rEthJun2025,
      'dPtREthJun2025',
      'ownerSetIsTokenConverterTrusted',
      [wrapperV4, true],
    ),
  );
  return transactions;
}

async function deployPtWstEthJun2024Updates(core: CoreProtocolArbitrumOne): Promise<EncodedTransaction[]> {
  const unwrapperV4 = await deployContractAndSave(
    'PendlePtIsolationModeUnwrapperTraderV2',
    getPendlePtIsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem!.wstEthJun2024.pendleRegistry,
      core.tokens.wstEth!,
      core.pendleEcosystem!.wstEthJun2024.dPtWstEthJun2024,
    ),
    'PendlePtWstEthJun2024IsolationModeUnwrapperTraderV4',
  );
  const wrapperV4 = await deployContractAndSave(
    'PendlePtIsolationModeWrapperTraderV2',
    getPendlePtIsolationModeWrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem!.wstEthJun2024.pendleRegistry,
      core.tokens.wstEth!,
      core.pendleEcosystem!.wstEthJun2024.dPtWstEthJun2024,
    ),
    'PendlePtWstEthJun2024IsolationModeWrapperTraderV4',
  );
  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.wstEthJun2024,
      'dPtWstEthJun2024',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.PendlePtWstEthJun2024IsolationModeUnwrapperTraderV3['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.wstEthJun2024,
      'dPtWstEthJun2024',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.PendlePtWstEthJun2024IsolationModeWrapperTraderV3['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.wstEthJun2024,
      'dPtWstEthJun2024',
      'ownerSetIsTokenConverterTrusted',
      [unwrapperV4, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.wstEthJun2024,
      'dPtWstEthJun2024',
      'ownerSetIsTokenConverterTrusted',
      [wrapperV4, true],
    ),
  );
  return transactions;
}

async function deployPtWstEthJun2025Updates(core: CoreProtocolArbitrumOne): Promise<EncodedTransaction[]> {
  const unwrapperV4 = await deployContractAndSave(
    'PendlePtIsolationModeUnwrapperTraderV2',
    getPendlePtIsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem!.wstEthJun2025.pendleRegistry,
      core.tokens.wstEth!,
      core.pendleEcosystem!.wstEthJun2025.dPtWstEthJun2025,
    ),
    'PendlePtWstEthJun2025IsolationModeUnwrapperTraderV4',
  );
  const wrapperV4 = await deployContractAndSave(
    'PendlePtIsolationModeWrapperTraderV2',
    getPendlePtIsolationModeWrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem!.wstEthJun2025.pendleRegistry,
      core.tokens.wstEth!,
      core.pendleEcosystem!.wstEthJun2025.dPtWstEthJun2025,
    ),
    'PendlePtWstEthJun2025IsolationModeWrapperTraderV4',
  );
  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.wstEthJun2025,
      'dPtWstEthJun2025',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.PendlePtWstEthJun2025IsolationModeUnwrapperTraderV3['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.wstEthJun2025,
      'dPtWstEthJun2025',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.PendlePtWstEthJun2025IsolationModeWrapperTraderV3['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.wstEthJun2025,
      'dPtWstEthJun2025',
      'ownerSetIsTokenConverterTrusted',
      [unwrapperV4, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.wstEthJun2025,
      'dPtWstEthJun2025',
      'ownerSetIsTokenConverterTrusted',
      [wrapperV4, true],
    ),
  );
  return transactions;
}

async function deployVARBUpdates(core: CoreProtocolArbitrumOne): Promise<EncodedTransaction[]> {
  const unwrapperV4 = await deployContractAndSave(
    'SimpleIsolationModeUnwrapperTraderV2',
    getARBUnwrapperTraderV2ConstructorParams(
      core.arbEcosystem!.live.dArb,
      core,
    ),
    'ARBIsolationModeUnwrapperTraderV4',
  );
  const wrapperV4 = await deployContractAndSave(
    'SimpleIsolationModeWrapperTraderV2',
    getARBWrapperTraderV2ConstructorParams(
      core.arbEcosystem!.live.dArb,
      core,
    ),
    'ARBIsolationModeWrapperTraderV4',
  );
  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.arbEcosystem!.live,
      'dArb',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.ARBIsolationModeUnwrapperTraderV3['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.arbEcosystem!.live,
      'dArb',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.ARBIsolationModeWrapperTraderV3['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.arbEcosystem!.live,
      'dArb',
      'ownerSetIsTokenConverterTrusted',
      [unwrapperV4, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.arbEcosystem!.live,
      'dArb',
      'ownerSetIsTokenConverterTrusted',
      [wrapperV4, true],
    ),
  );
  return transactions;
}

async function deployStakedGmxUpdates(core: CoreProtocolArbitrumOne): Promise<EncodedTransaction[]> {
  const unwrapperV4 = await deployContractAndSave(
    'SimpleIsolationModeUnwrapperTraderV2',
    getGMXUnwrapperTraderV2ConstructorParams(
      core.gmxEcosystem!.live.dGmx,
      core,
    ),
    'GMXIsolationModeUnwrapperTraderV4',
  );
  const wrapperV4 = await deployContractAndSave(
    'SimpleIsolationModeWrapperTraderV2',
    getGMXWrapperTraderV2ConstructorParams(
      core.gmxEcosystem!.live.dGmx,
      core,
    ),
    'GMXIsolationModeWrapperTraderV4',
  );
  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem!.live,
      'dGmx',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.GMXIsolationModeUnwrapperTraderV3['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem!.live,
      'dGmx',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.GMXIsolationModeWrapperTraderV3['42161'].address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem!.live,
      'dGmx',
      'ownerSetIsTokenConverterTrusted',
      [unwrapperV4, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem!.live,
      'dGmx',
      'ownerSetIsTokenConverterTrusted',
      [wrapperV4, true],
    ),
  );
  return transactions;
}

/**
 * This script encodes the following transactions:
 * - Deploys new unwrapper / wrappers for each Isolation Mode asset
 * - Sets the new unwrappers / wrappers for each isolation mode asset on the corresponding factories + registries
 */
async function main(): Promise<DenJsonUpload> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const transactions: EncodedTransaction[] = [
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
