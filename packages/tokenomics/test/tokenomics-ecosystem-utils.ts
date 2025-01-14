import { createContractWithAbi, createContractWithLibrary, createContractWithName } from 'packages/base/src/utils/dolomite-utils';
import {
  DOLO,
  DOLO__factory,
  ExternalVesterDiscountCalculatorV1,
  IERC20,
  IVesterDiscountCalculator,
  MockVotingEscrow,
  ODOLO,
  ODOLO__factory,
  OptionAirdrop,
  OptionAirdrop__factory,
  RegularAirdrop,
  RegularAirdrop__factory,
  StrategicVestingClaims,
  StrategicVestingClaims__factory,
  TestOptionAirdrop,
  TestOptionAirdrop__factory,
  TestVeExternalVesterImplementationV1,
  TestVeExternalVesterImplementationV1__factory,
  UpgradeableProxy,
  UpgradeableProxy__factory,
  VeFeeCalculator,
  VeFeeCalculator__factory,
  VestingClaims,
  VestingClaims__factory,
  VotingEscrow,
  VotingEscrow__factory
} from '../src/types';
import { ADDRESS_ZERO, BYTES_EMPTY, NetworkType } from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolType } from 'packages/base/test/utils/setup';
import {
  getDOLOConstructorParams,
  getExternalVesterDiscountCalculatorConstructorParams,
  getODOLOConstructorParams,
  getOptionAirdropConstructorParams,
  getRegularAirdropConstructorParams,
  getStrategicVestingClaimsConstructorParams,
  getUpgradeableProxyConstructorParams,
  getVeExternalVesterImplementationConstructorParams,
  getVeExternalVesterInitializationCalldata,
  getVeFeeCalculatorConstructorParams,
  getVestingClaimsConstructorParams
} from '../src/tokenomics-constructors';
import { BigNumberish } from 'ethers';
import { ExternalVesterDiscountCalculatorV1__factory } from 'packages/liquidity-mining/src/types';

export async function createDOLO<T extends NetworkType>(
  core: CoreProtocolType<T>,
  treasury: string
): Promise<DOLO> {
  return createContractWithAbi<DOLO>(
    DOLO__factory.abi,
    DOLO__factory.bytecode,
    getDOLOConstructorParams(core, treasury)
  );
}

export async function createODOLO<T extends NetworkType>(
  core: CoreProtocolType<T>
): Promise<ODOLO> {
  return createContractWithAbi<ODOLO>(
    ODOLO__factory.abi,
    ODOLO__factory.bytecode,
    getODOLOConstructorParams(core)
  );
}

export async function createVeFeeCalculator<T extends NetworkType>(
  core: CoreProtocolType<T>
): Promise<VeFeeCalculator> {
  return createContractWithAbi<VeFeeCalculator>(
    VeFeeCalculator__factory.abi,
    VeFeeCalculator__factory.bytecode,
    getVeFeeCalculatorConstructorParams(core),
  );
}

export async function createVotingEscrow<T extends NetworkType>(
  core: CoreProtocolType<T>,
  dolo: IERC20,
  voter: string,
  feeCalculator: VeFeeCalculator,
  vester: string,
  buybackPool: string,
): Promise<VotingEscrow> {
  const implementation = await createContractWithAbi<VotingEscrow>(
    VotingEscrow__factory.abi,
    VotingEscrow__factory.bytecode,
    [],
  );
  const initializeCalldata = await implementation.populateTransaction.initialize(
    dolo.address,
    ADDRESS_ZERO,
    voter,
    feeCalculator.address,
    vester,
    buybackPool,
    core.governance.address
  );

  const proxy = await createContractWithAbi<UpgradeableProxy>(
    UpgradeableProxy__factory.abi,
    UpgradeableProxy__factory.bytecode,
    getUpgradeableProxyConstructorParams(core, implementation, initializeCalldata.data!),
  );
  return VotingEscrow__factory.connect(proxy.address, core.hhUser1);
}

export async function createExternalVesterDiscountCalculatorV1(
  veToken: VotingEscrow
): Promise<ExternalVesterDiscountCalculatorV1> {
  return createContractWithAbi<ExternalVesterDiscountCalculatorV1>(
    ExternalVesterDiscountCalculatorV1__factory.abi,
    ExternalVesterDiscountCalculatorV1__factory.bytecode,
    getExternalVesterDiscountCalculatorConstructorParams(veToken),
  );
}

export async function createTestVeExternalVesterV1Proxy<T extends NetworkType>(
  core: CoreProtocolType<T>,
  pairToken: IERC20,
  pairMarketId: BigNumberish,
  paymentToken: IERC20,
  paymentMarketId: BigNumberish,
  rewardToken: IERC20,
  rewardMarketId: BigNumberish,
  discountCalculator: IVesterDiscountCalculator,
  oToken: IERC20,
  baseUri: string,
  name: string,
  symbol: string,
): Promise<TestVeExternalVesterImplementationV1> {
  const safeDelegateCallLib = await createContractWithName('SafeDelegateCallLib', []);
  const implementation = await createContractWithLibrary<TestVeExternalVesterImplementationV1>(
    'TestVeExternalVesterImplementationV1',
    { SafeDelegateCallLib: safeDelegateCallLib.address },
    getVeExternalVesterImplementationConstructorParams(
      core,
      pairToken,
      pairMarketId,
      paymentToken,
      paymentMarketId,
      rewardToken,
      rewardMarketId,
    ),
  );
  const implementationCalldata = await implementation.populateTransaction.initialize(
    getVeExternalVesterInitializationCalldata(discountCalculator, oToken, baseUri, name, symbol),
  );
  const vesterProxy = await createContractWithAbi<UpgradeableProxy>(
    UpgradeableProxy__factory.abi,
    UpgradeableProxy__factory.bytecode,
    getUpgradeableProxyConstructorParams(core, implementation, implementationCalldata.data!),
  );
  return TestVeExternalVesterImplementationV1__factory.connect(vesterProxy.address, core.hhUser1);
}

export async function createTestOptionAirdropImplementation<T extends NetworkType>(
  core: CoreProtocolType<T>,
  dolo: DOLO,
): Promise<TestOptionAirdrop> {
  return createContractWithAbi<TestOptionAirdrop>(
    TestOptionAirdrop__factory.abi,
    TestOptionAirdrop__factory.bytecode,
    getOptionAirdropConstructorParams(core, dolo),
  );
}

export async function createTestOptionAirdrop<T extends NetworkType>(
  core: CoreProtocolType<T>,
  dolo: DOLO,
  treasury: string,
): Promise<TestOptionAirdrop> {
  const implementation = await createTestOptionAirdropImplementation(core, dolo);
  const calldata = await implementation.populateTransaction.initialize(treasury);
  const proxy = await createUpgradeableProxy(core, implementation, calldata.data!);
  return TestOptionAirdrop__factory.connect(proxy.address, core.hhUser1);
}

export async function createOptionAirdropImplementation<T extends NetworkType>(
  core: CoreProtocolType<T>,
  dolo: DOLO,
): Promise<OptionAirdrop> {
  return createContractWithAbi<OptionAirdrop>(
    OptionAirdrop__factory.abi,
    OptionAirdrop__factory.bytecode,
    getOptionAirdropConstructorParams(core, dolo),
  );
}

export async function createOptionAirdrop<T extends NetworkType>(
  core: CoreProtocolType<T>,
  dolo: DOLO,
  treasury: string,
): Promise<OptionAirdrop> {
  const implementation = await createOptionAirdropImplementation(core, dolo);
  const calldata = await implementation.populateTransaction.initialize(treasury);
  const proxy = await createUpgradeableProxy(core, implementation, calldata.data!);
  return OptionAirdrop__factory.connect(proxy.address, core.hhUser1);
}

export async function createRegularAirdropImplementation<T extends NetworkType>(
  core: CoreProtocolType<T>,
  dolo: DOLO,
  veToken: VotingEscrow | MockVotingEscrow,
): Promise<RegularAirdrop> {
  return createContractWithAbi<RegularAirdrop>(
    RegularAirdrop__factory.abi,
    RegularAirdrop__factory.bytecode,
    getRegularAirdropConstructorParams(core, dolo, veToken),
  );
}

export async function createRegularAirdrop<T extends NetworkType>(
  core: CoreProtocolType<T>,
  dolo: DOLO,
  veToken: VotingEscrow | MockVotingEscrow,
): Promise<RegularAirdrop> {
  const implementation = await createRegularAirdropImplementation(core, dolo, veToken);
  const proxy = await createUpgradeableProxy(core, implementation, BYTES_EMPTY);
  return RegularAirdrop__factory.connect(proxy.address, core.hhUser1);
}

export async function createVestingClaimsImplementation<T extends NetworkType>(
  core: CoreProtocolType<T>,
  dolo: DOLO,
  tgeTimestamp: BigNumberish,
  duration: BigNumberish,
): Promise<VestingClaims> {
  return createContractWithAbi<VestingClaims>(
    VestingClaims__factory.abi,
    VestingClaims__factory.bytecode,
    getVestingClaimsConstructorParams(core, dolo, tgeTimestamp, duration),
  );
}

export async function createVestingClaims<T extends NetworkType>(
  core: CoreProtocolType<T>,
  dolo: DOLO,
  tgeTimestamp: BigNumberish,
  duration: BigNumberish,
): Promise<VestingClaims> {
  const implementation = await createVestingClaimsImplementation(core, dolo, tgeTimestamp, duration);
  const proxy = await createUpgradeableProxy(core, implementation, BYTES_EMPTY);
  return VestingClaims__factory.connect(proxy.address, core.hhUser1);
}

export async function createStrategicVestingClaimsImplementation<T extends NetworkType>(
  core: CoreProtocolType<T>,
  dolo: DOLO,
  tgeTimestamp: BigNumberish,
  duration: BigNumberish,
): Promise<StrategicVestingClaims> {
  return createContractWithAbi<StrategicVestingClaims>(
    StrategicVestingClaims__factory.abi,
    StrategicVestingClaims__factory.bytecode,
    getStrategicVestingClaimsConstructorParams(core, dolo, tgeTimestamp, duration),
  );
}

export async function createStrategicVestingClaims<T extends NetworkType>(
  core: CoreProtocolType<T>,
  dolo: DOLO,
  tgeTimestamp: BigNumberish,
  duration: BigNumberish,
): Promise<StrategicVestingClaims> {
  const implementation = await createStrategicVestingClaimsImplementation(core, dolo, tgeTimestamp, duration);
  const proxy = await createUpgradeableProxy(core, implementation, BYTES_EMPTY);
  return StrategicVestingClaims__factory.connect(proxy.address, core.hhUser1);
}

export async function createUpgradeableProxy<T extends NetworkType>(
  core: CoreProtocolType<T>,
  implementation: { address: string },
  calldata: string,
): Promise<UpgradeableProxy> {
  return createContractWithAbi<UpgradeableProxy>(
    UpgradeableProxy__factory.abi,
    UpgradeableProxy__factory.bytecode,
    getUpgradeableProxyConstructorParams(core, implementation, calldata),
  );
}
