
// tslint:disable-next-line
export async function createBerachainRewardsIsolationModeTokenVaultV1(): Promise<BerachainRewardsIsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<BerachainRewardsIsolationModeTokenVaultV1>(
    'BerachainRewardsIsolationModeTokenVaultV1',
    libraries,
    [],
  );
}

export async function createBerachainRewardsIsolationModeVaultFactory(
  beraRegistry: IBerachainRewardsRegistry | BerachainRewardsRegistry,
  underlyingToken: { address: string },
  userVaultImplementation: BerachainRewardsIsolationModeTokenVaultV1,
  core: CoreProtocolBerachain,
): Promise<BerachainRewardsIsolationModeVaultFactory> {
  return createContractWithAbi<BerachainRewardsIsolationModeVaultFactory>(
    BerachainRewardsIsolationModeVaultFactory__factory.abi,
    BerachainRewardsIsolationModeVaultFactory__factory.bytecode,
    getBerachainRewardsIsolationModeVaultFactoryConstructorParams(
      beraRegistry,
      underlyingToken,
      userVaultImplementation,
      core,
    ),
  );
}

export async function createBGTIsolationModeTokenVaultV1(): Promise<BGTIsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<BGTIsolationModeTokenVaultV1>('BGTIsolationModeTokenVaultV1', libraries, []);
}

export async function createBGTIsolationModeVaultFactory(
  beraRegistry: IBerachainRewardsRegistry | BerachainRewardsRegistry,
  underlyingToken: { address: string },
  userVaultImplementation: BGTIsolationModeTokenVaultV1,
  core: CoreProtocolBerachain,
): Promise<BGTIsolationModeVaultFactory> {
  return createContractWithAbi<BGTIsolationModeVaultFactory>(
    BGTIsolationModeVaultFactory__factory.abi,
    BGTIsolationModeVaultFactory__factory.bytecode,
    getBGTIsolationModeVaultFactoryConstructorParams(beraRegistry, underlyingToken, userVaultImplementation, core),
  );
}

export async function createBGTMIsolationModeTokenVaultV1(): Promise<BGTMIsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<BGTMIsolationModeTokenVaultV1>('BGTMIsolationModeTokenVaultV1', libraries, []);
}

export async function createBGTMIsolationModeVaultFactory(
  beraRegistry: IBerachainRewardsRegistry | BerachainRewardsRegistry,
  underlyingToken: { address: string },
  userVaultImplementation: BGTMIsolationModeTokenVaultV1,
  core: CoreProtocolBerachain,
): Promise<BGTMIsolationModeVaultFactory> {
  return createContractWithAbi<BGTMIsolationModeVaultFactory>(
    BGTMIsolationModeVaultFactory__factory.abi,
    BGTMIsolationModeVaultFactory__factory.bytecode,
    getBGTMIsolationModeVaultFactoryConstructorParams(beraRegistry, underlyingToken, userVaultImplementation, core),
  );
}
