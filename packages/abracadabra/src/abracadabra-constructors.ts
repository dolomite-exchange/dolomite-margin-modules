

export function getMagicGLPPriceOracleConstructorParams(core: CoreProtocolArbitrumOne): any[] {
  return [
    core.dolomiteMargin.address,
    core.abraEcosystem!.magicGlp.address,
    core.marketIds.dfsGlp!,
  ];
}

export function getMagicGLPWithChainlinkAutomationPriceOracleConstructorParams(
  core: CoreProtocolArbitrumOne,
): any[] {
  return [
    core.dolomiteMargin.address,
    core.chainlinkAutomationRegistry.address,
    core.abraEcosystem!.magicGlp.address,
    core.marketIds.dfsGlp!,
  ];
}

export function getMagicGLPUnwrapperTraderV1ConstructorParams(core: CoreProtocolArbitrumOne): any[] {
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

export function getMagicGLPUnwrapperTraderV2ConstructorParams(core: CoreProtocolArbitrumOne): any[] {
  if (!core.abraEcosystem) {
    throw new Error('Abra ecosystem not initialized');
  }

  return [
    core.abraEcosystem!.magicGlp.address,
    core.gmxEcosystem!.live.gmxRegistry.address,
    core.dolomiteMargin.address,
  ];
}

export function getMagicGLPWrapperTraderV1ConstructorParams(core: CoreProtocolArbitrumOne): any[] {
  if (!core.abraEcosystem) {
    throw new Error('Abra ecosystem not initialized');
  }

  return [
    core.abraEcosystem!.magicGlp.address,
    core.gmxEcosystem!.live.gmxRegistry.address,
    core.dolomiteMargin.address,
  ];
}

export function getMagicGLPWrapperTraderV2ConstructorParams(core: CoreProtocolArbitrumOne): any[] {
  if (!core.abraEcosystem) {
    throw new Error('Abra ecosystem not initialized');
  }

  return [
    core.abraEcosystem!.magicGlp.address,
    core.gmxEcosystem!.live.gmxRegistry.address,
    core.dolomiteMargin.address,
  ];
}
