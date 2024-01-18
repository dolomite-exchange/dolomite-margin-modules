import { CoreProtocol } from '../../../packages/base/test/utils/setup';
import { IChainlinkRegistry } from '../../types';

export function getMagicGLPPriceOracleConstructorParams(core: CoreProtocol): any[] {
  return [
    core.dolomiteMargin.address,
    core.abraEcosystem!.magicGlp.address,
    core.marketIds.dfsGlp!,
  ];
}

export function getMagicGLPWithChainlinkAutomationPriceOracleConstructorParams(
  core: CoreProtocol,
): any[] {
  return [
    core.dolomiteMargin.address,
    core.chainlinkRegistry!.address,
    core.abraEcosystem!.magicGlp.address,
    core.marketIds.dfsGlp!,
  ];
}

export function getMagicGLPUnwrapperTraderV1ConstructorParams(core: CoreProtocol): any[] {
  if (!core.abraEcosystem) {
    throw new Error('Abra ecosystem not initialized');
  }

  return [
    core.abraEcosystem!.magicGlp.address,
    core.gmxEcosystem!.live.gmxRegistry.address,
    core.marketIds.usdc,
    core.dolomiteMargin.address,
  ];
}

export function getMagicGLPUnwrapperTraderV2ConstructorParams(core: CoreProtocol): any[] {
  if (!core.abraEcosystem) {
    throw new Error('Abra ecosystem not initialized');
  }

  return [
    core.abraEcosystem!.magicGlp.address,
    core.gmxEcosystem!.live.gmxRegistry.address,
    core.dolomiteMargin.address,
  ];
}

export function getMagicGLPWrapperTraderV1ConstructorParams(core: CoreProtocol): any[] {
  if (!core.abraEcosystem) {
    throw new Error('Abra ecosystem not initialized');
  }

  return [
    core.abraEcosystem!.magicGlp.address,
    core.gmxEcosystem!.live.gmxRegistry.address,
    core.dolomiteMargin.address,
  ];
}

export function getMagicGLPWrapperTraderV2ConstructorParams(core: CoreProtocol): any[] {
  if (!core.abraEcosystem) {
    throw new Error('Abra ecosystem not initialized');
  }

  return [
    core.abraEcosystem!.magicGlp.address,
    core.gmxEcosystem!.live.gmxRegistry.address,
    core.dolomiteMargin.address,
  ];
}
