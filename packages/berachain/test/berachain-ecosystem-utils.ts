import { ADDRESS_ZERO } from '@dolomite-exchange/zap-sdk/dist/src/lib/Constants';
import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import {
  GenericEventEmissionType,
  GenericTraderParam,
  GenericTraderType,
} from '@dolomite-margin/dist/src/modules/GenericTraderProxyV1';
import { BigNumber } from 'ethers';
import { defaultAbiCoder } from 'ethers/lib/utils';
import { DolomiteERC4626, DolomiteERC4626__factory, LiquidatorProxyV5, RegistryProxy, RegistryProxy__factory } from 'packages/base/src/types';
import { createContractWithAbi, createContractWithLibrary } from 'packages/base/src/utils/dolomite-utils';
import { MAX_UINT_256_BI, ONE_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { impersonate } from 'packages/base/test/utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { createIsolationModeTokenVaultV1ActionsImpl } from 'packages/base/test/utils/dolomite';
import {
  getBerachainRewardsRegistryConstructorParams,
  getInfraredBGTIsolationModeVaultFactoryConstructorParams,
  getPOLIsolationModeVaultFactoryConstructorParams,
} from '../src/berachain-constructors';
import {
  BerachainRewardsRegistry,
  BerachainRewardsRegistry__factory,
  IBaseMetaVault,
  IBaseMetaVault__factory,
  IBerachainRewardsRegistry, IERC4626__factory,
  InfraredBGTIsolationModeTokenVaultV1,
  InfraredBGTIsolationModeVaultFactory,
  InfraredBGTIsolationModeVaultFactory__factory,
  InfraredBGTMetaVault,
  IPOLLiquidatorProxyV1,
  POLIsolationModeTokenVaultV1,
  POLIsolationModeUnwrapperTraderV2,
  POLIsolationModeUnwrapperTraderV2__factory,
  POLIsolationModeUnwrapperUpgradeableProxy,
  POLIsolationModeUnwrapperUpgradeableProxy__factory,
  POLIsolationModeVaultFactory,
  POLIsolationModeVaultFactory__factory,
  POLIsolationModeWrapperTraderV2,
  POLIsolationModeWrapperTraderV2__factory,
  POLIsolationModeWrapperUpgradeableProxy,
  POLIsolationModeWrapperUpgradeableProxy__factory,
  POLLiquidatorProxyV1,
  POLLiquidatorProxyV1__factory,
  TestBerachainRewardsRegistry,
  TestBerachainRewardsRegistry__factory,
  TestPOLLiquidatorProxyV1,
  TestPOLLiquidatorProxyV1__factory,
} from '../src/types';
import { Ownable__factory } from 'packages/tokenomics/src/types';
import { UpgradeableProxy__factory } from 'packages/liquidity-mining/src/types';
import { createDolomiteOwnerV2 } from '@dolomite-exchange/modules-admin/test/admin-ecosystem-utils';

export enum RewardVaultType {
  Infrared,
  Native,
  BGTM,
}

export async function createBerachainRewardsRegistry(
  core: CoreProtocolBerachain,
  metaVaultImplementation: InfraredBGTMetaVault | IBaseMetaVault,
  polLiquidator: IPOLLiquidatorProxyV1,
): Promise<BerachainRewardsRegistry> {
  const implementation = await createContractWithAbi<BerachainRewardsRegistry>(
    BerachainRewardsRegistry__factory.abi,
    BerachainRewardsRegistry__factory.bytecode,
    [],
  );
  const proxy = await createContractWithAbi<RegistryProxy>(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getBerachainRewardsRegistryConstructorParams(implementation, metaVaultImplementation, polLiquidator, core),
  );
  return BerachainRewardsRegistry__factory.connect(proxy.address, core.hhUser1);
}

export async function createTestBerachainRewardsRegistry(
  core: CoreProtocolBerachain,
  metaVaultImplementation: InfraredBGTMetaVault | IBaseMetaVault,
  polLiquidator: IPOLLiquidatorProxyV1,
): Promise<TestBerachainRewardsRegistry> {
  const implementation = await createContractWithAbi<TestBerachainRewardsRegistry>(
    TestBerachainRewardsRegistry__factory.abi,
    TestBerachainRewardsRegistry__factory.bytecode,
    [],
  );
  const proxy = await createContractWithAbi<RegistryProxy>(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getBerachainRewardsRegistryConstructorParams(implementation, metaVaultImplementation, polLiquidator, core),
  );
  return TestBerachainRewardsRegistry__factory.connect(proxy.address, core.hhUser1);
}

export async function createInfraredBGTIsolationModeTokenVaultV1(): Promise<InfraredBGTIsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<InfraredBGTIsolationModeTokenVaultV1>(
    'InfraredBGTIsolationModeTokenVaultV1',
    libraries,
    [],
  );
}

export async function createInfraredBGTIsolationModeVaultFactory(
  beraRegistry: IBerachainRewardsRegistry | BerachainRewardsRegistry,
  underlyingToken: { address: string },
  userVaultImplementation: InfraredBGTIsolationModeTokenVaultV1,
  core: CoreProtocolBerachain,
): Promise<InfraredBGTIsolationModeVaultFactory> {
  return createContractWithAbi<InfraredBGTIsolationModeVaultFactory>(
    InfraredBGTIsolationModeVaultFactory__factory.abi,
    InfraredBGTIsolationModeVaultFactory__factory.bytecode,
    getInfraredBGTIsolationModeVaultFactoryConstructorParams(
      beraRegistry,
      underlyingToken,
      userVaultImplementation,
      core,
    ),
  );
}

export async function createPOLIsolationModeTokenVaultV1(): Promise<POLIsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<POLIsolationModeTokenVaultV1>('POLIsolationModeTokenVaultV1', libraries, []);
}

export async function createPOLIsolationModeVaultFactory(
  core: CoreProtocolBerachain,
  beraRegistry: IBerachainRewardsRegistry | BerachainRewardsRegistry,
  dToken: { address: string },
  userVaultImplementation: POLIsolationModeTokenVaultV1,
  initialAllowableDebtMarketIds: number[],
  initialAllowableCollateralMarketIds: number[],
): Promise<POLIsolationModeVaultFactory> {
  const underlyingAddress = await IERC4626__factory.connect(dToken.address, core.hhUser1).asset();
  const underlyingSymbol = await IERC4626__factory.connect(underlyingAddress, core.hhUser1).symbol();

  return createContractWithAbi<POLIsolationModeVaultFactory>(
    POLIsolationModeVaultFactory__factory.abi,
    POLIsolationModeVaultFactory__factory.bytecode,
    getPOLIsolationModeVaultFactoryConstructorParams(
      core,
      underlyingSymbol,
      beraRegistry,
      dToken,
      userVaultImplementation,
      initialAllowableDebtMarketIds,
      initialAllowableCollateralMarketIds,
    ),
  );
}

export async function createPolLiquidatorProxy(
  core: CoreProtocolBerachain,
  liquidatorProxyV5: LiquidatorProxyV5,
): Promise<POLLiquidatorProxyV1> {
  const implementation = await createContractWithAbi<POLLiquidatorProxyV1>(
    POLLiquidatorProxyV1__factory.abi,
    POLLiquidatorProxyV1__factory.bytecode,
    [liquidatorProxyV5.address, core.dolomiteMargin.address],
  );
  const data = await implementation.populateTransaction.initialize();
  const proxy = await createContractWithAbi(
    UpgradeableProxy__factory.abi,
    UpgradeableProxy__factory.bytecode,
    [implementation.address, core.dolomiteMargin.address, data.data!],
  );
  return POLLiquidatorProxyV1__factory.connect(proxy.address, core.hhUser1);
}

export async function createTestPolLiquidatorProxy(
  core: CoreProtocolBerachain,
  liquidatorProxyV5: LiquidatorProxyV5,
): Promise<TestPOLLiquidatorProxyV1> {
  const implementation = await createContractWithAbi<TestPOLLiquidatorProxyV1>(
    TestPOLLiquidatorProxyV1__factory.abi,
    TestPOLLiquidatorProxyV1__factory.bytecode,
    [liquidatorProxyV5.address, core.dolomiteMargin.address],
  );
  const data = await implementation.populateTransaction.initialize();
  const proxy = await createContractWithAbi(
    UpgradeableProxy__factory.abi,
    UpgradeableProxy__factory.bytecode,
    [implementation.address, core.dolomiteMargin.address, data.data!],
  );
  return TestPOLLiquidatorProxyV1__factory.connect(proxy.address, core.hhUser1);
}

export async function createPOLIsolationModeWrapperTraderV2(
  core: CoreProtocolBerachain,
  beraRegistry: IBerachainRewardsRegistry | BerachainRewardsRegistry,
  factory: POLIsolationModeVaultFactory,
): Promise<POLIsolationModeWrapperTraderV2> {
  const wrapperImpl = await createContractWithAbi<POLIsolationModeWrapperTraderV2>(
    POLIsolationModeWrapperTraderV2__factory.abi,
    POLIsolationModeWrapperTraderV2__factory.bytecode,
    [beraRegistry.address, core.dolomiteMargin.address],
  );
  await beraRegistry.connect(core.governance).ownerSetPolWrapperTrader(wrapperImpl.address);
  const calldata = await wrapperImpl.populateTransaction.initialize(factory.address);
  const proxy = await createContractWithAbi<POLIsolationModeWrapperUpgradeableProxy>(
    POLIsolationModeWrapperUpgradeableProxy__factory.abi,
    POLIsolationModeWrapperUpgradeableProxy__factory.bytecode,
    [beraRegistry.address, calldata.data!],
  );
  return POLIsolationModeWrapperTraderV2__factory.connect(proxy.address, core.hhUser1);
}

export async function createPOLIsolationModeUnwrapperTraderV2(
  core: CoreProtocolBerachain,
  beraRegistry: IBerachainRewardsRegistry | BerachainRewardsRegistry,
  factory: POLIsolationModeVaultFactory,
): Promise<POLIsolationModeUnwrapperTraderV2> {
  const unwrapperImpl = await createContractWithAbi<POLIsolationModeUnwrapperTraderV2>(
    POLIsolationModeUnwrapperTraderV2__factory.abi,
    POLIsolationModeUnwrapperTraderV2__factory.bytecode,
    [beraRegistry.address, core.dolomiteMargin.address],
  );
  await beraRegistry.connect(core.governance).ownerSetPolUnwrapperTrader(unwrapperImpl.address);
  const calldata = await unwrapperImpl.populateTransaction.initialize(factory.address);
  const proxy = await createContractWithAbi<POLIsolationModeUnwrapperUpgradeableProxy>(
    POLIsolationModeUnwrapperUpgradeableProxy__factory.abi,
    POLIsolationModeUnwrapperUpgradeableProxy__factory.bytecode,
    [beraRegistry.address, calldata.data!],
  );
  return POLIsolationModeUnwrapperTraderV2__factory.connect(proxy.address, core.hhUser1);
}

export async function setupUserMetaVault(
  user: SignerWithAddressWithSafety,
  registry: IBerachainRewardsRegistry | BerachainRewardsRegistry,
): Promise<IBaseMetaVault> {
  const metaVaultAddress = await registry.getMetaVaultByAccount(user.address);
  if (metaVaultAddress === ADDRESS_ZERO) {
    return Promise.reject(new Error('MetaVault not set up yet'));
  }

  return IBaseMetaVault__factory.connect(metaVaultAddress, user);
}

export async function impersonateUserMetaVault(
  user: SignerWithAddressWithSafety,
  registry: IBerachainRewardsRegistry | BerachainRewardsRegistry,
): Promise<SignerWithAddressWithSafety> {
  return impersonate(await setupUserMetaVault(user, registry));
}

export async function upgradeAndSetupDTokensAndOwnerForPOLTests(core: CoreProtocolBerachain) {
  const dToken = DolomiteERC4626__factory.connect(core.dolomiteTokens.weth!.address, core.hhUser1);
  const implementation = await createContractWithAbi<DolomiteERC4626>(
    DolomiteERC4626__factory.abi,
    DolomiteERC4626__factory.bytecode,
    [core.dolomiteRegistry.address, core.dolomiteMargin.address],
  );
  const dTokenProxy = RegistryProxy__factory.connect(dToken.address, core.governance);
  await dTokenProxy.upgradeTo(implementation.address);

  const dolomiteOwner = (await createDolomiteOwnerV2(core, 30)).connect(core.gnosisSafe);
  const bypassTimelockRole = await dolomiteOwner.BYPASS_TIMELOCK_ROLE();
  const executorRole = await dolomiteOwner.EXECUTOR_ROLE();
  const dTokenRole = '0xcd86ded6d567eb7adb1b98d283b7e4004869021f7651dbae982e0992bfe0df5a';
  const ownable = Ownable__factory.connect(core.dolomiteMargin.address, core.governance);
  await ownable.transferOwnership(dolomiteOwner.address);

  await dolomiteOwner.ownerAddRole(dTokenRole);
  await dolomiteOwner.connect(core.gnosisSafe).grantRole(bypassTimelockRole, dToken.address);
  await dolomiteOwner.connect(core.gnosisSafe).grantRole(executorRole, dToken.address);

  await dolomiteOwner.connect(core.gnosisSafe).grantRole(dTokenRole, dToken.address);
  await dolomiteOwner.connect(core.gnosisSafe).ownerAddRoleToAddressFunctionSelectors(
    dTokenRole,
    core.dolomiteMargin.address,
    ['0x8f6bc659']
  );
}

export async function wrapFullBalanceIntoVaultDefaultAccount(
  core: CoreProtocolBerachain,
  vault: POLIsolationModeTokenVaultV1,
  metaVault: InfraredBGTMetaVault,
  wrapper: POLIsolationModeWrapperTraderV2,
  marketId: BigNumber,
) {
  const wrapperParam: GenericTraderParam = {
    trader: wrapper.address,
    traderType: GenericTraderType.IsolationModeWrapper,
    tradeData: defaultAbiCoder.encode(['uint256'], [2]),
    makerAccountIndex: 0,
  };
  await vault.addCollateralAndSwapExactInputForOutput(
    ZERO_BI,
    ZERO_BI,
    [core.marketIds.weth, marketId],
    MAX_UINT_256_BI,
    ONE_BI,
    [wrapperParam],
    [
      {
        owner: metaVault.address,
        number: ZERO_BI,
      },
    ],
    {
      deadline: '123123123123123',
      balanceCheckFlag: BalanceCheckFlag.None,
      eventType: GenericEventEmissionType.None,
    },
  );
}
