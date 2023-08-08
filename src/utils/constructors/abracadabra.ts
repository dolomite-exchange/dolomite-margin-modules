import { CoreProtocol } from '../../../test/utils/setup';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

export function getMagicGLPPriceOracleConstructorParams(core: CoreProtocol): any[] {
  return [
    core.dolomiteMargin.address,
    core.abraEcosystem!.magicGlp.address,
    core.marketIds.dfsGlp!,
  ];
}

export function getMagicGLPWithChainlinkAutomationPriceOracleConstructorParams(
  core: CoreProtocol,
  chainlinkRegistry: SignerWithAddress
): any[] {
  return [
    core.dolomiteMargin.address,
    chainlinkRegistry.address,
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
