import { BigNumberish, PopulatedTransaction } from 'ethers';
import { getUpgradeableProxyConstructorParams } from 'packages/base/src/utils/constructors/dolomite';
import {
  createContractWithAbi,
  createContractWithLibrary,
  createContractWithName,
} from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, DolomiteNetwork } from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolType } from 'packages/base/test/utils/setup';
import { UpgradeableProxy, UpgradeableProxy__factory } from 'packages/liquidity-mining/src/types';
import {
  getDOLOBuybackPoolConstructorParams,
  getDOLOConstructorParams,
  getExternalVesterDiscountCalculatorConstructorParams,
  getODOLOConstructorParams,
  getOptionAirdropConstructorParams,
  getRegularAirdropConstructorParams,
  getStrategicVestingClaimsConstructorParams,
  getVeExternalVesterImplementationConstructorParams,
  getVeExternalVesterInitializationCalldata,
  getVeFeeCalculatorConstructorParams,
  getVestingClaimsConstructorParams,
} from '../src/tokenomics-constructors';
import {
  DOLO,
  DOLO__factory,
  DOLOBuybackPool,
  DOLOBuybackPool__factory,
  DOLOWithOwnable,
  DOLOWithOwnable__factory,
  ExternalVesterDiscountCalculatorV1,
  ExternalVesterDiscountCalculatorV1__factory,
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
  TestRegularAirdrop,
  TestRegularAirdrop__factory,
  TestVeExternalVesterImplementationV1,
  TestVeExternalVesterImplementationV1__factory,
  TestVeToken,
  TestVeToken__factory,
  VeArt,
  VeArt__factory,
  VeFeeCalculator,
  VeFeeCalculator__factory,
  VestingClaims,
  VestingClaims__factory,
  VotingEscrow,
  VotingEscrow__factory,
} from '../src/types';

export async function createDOLO<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  treasury: string,
): Promise<DOLO> {
  return createContractWithAbi<DOLO>(
    DOLO__factory.abi,
    DOLO__factory.bytecode,
    getDOLOConstructorParams(core, treasury),
  );
}

export async function createDOLOWithOwnable(treasury: string): Promise<DOLOWithOwnable> {
  return createContractWithAbi<DOLOWithOwnable>(DOLOWithOwnable__factory.abi, DOLOWithOwnable__factory.bytecode, [
    treasury,
  ]);
}

export async function createODOLO<T extends DolomiteNetwork>(core: CoreProtocolType<T>): Promise<ODOLO> {
  return createContractWithAbi<ODOLO>(ODOLO__factory.abi, ODOLO__factory.bytecode, getODOLOConstructorParams(core));
}

export async function createDOLOBuybackPool<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  dolo: IERC20,
  oDolo: IERC20,
): Promise<DOLOBuybackPool> {
  return createContractWithAbi<DOLOBuybackPool>(
    DOLOBuybackPool__factory.abi,
    DOLOBuybackPool__factory.bytecode,
    getDOLOBuybackPoolConstructorParams(core, dolo, oDolo),
  );
}

export async function createVeArt(): Promise<VeArt> {
  return createContractWithAbi<VeArt>(VeArt__factory.abi, VeArt__factory.bytecode, []);
}

export async function createVeFeeCalculator<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
): Promise<VeFeeCalculator> {
  return createContractWithAbi<VeFeeCalculator>(
    VeFeeCalculator__factory.abi,
    VeFeeCalculator__factory.bytecode,
    getVeFeeCalculatorConstructorParams(core),
  );
}

export async function createVotingEscrow<T extends DolomiteNetwork>(
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
    core.governance.address,
  );

  const proxy = await createContractWithAbi<UpgradeableProxy>(
    UpgradeableProxy__factory.abi,
    UpgradeableProxy__factory.bytecode,
    getUpgradeableProxyConstructorParams(implementation.address, initializeCalldata, core.dolomiteMargin),
  );
  return VotingEscrow__factory.connect(proxy.address, core.hhUser1);
}

export async function createTestVeToken(underlyingToken: IERC20): Promise<TestVeToken> {
  return createContractWithAbi<TestVeToken>(TestVeToken__factory.abi, TestVeToken__factory.bytecode, [
    underlyingToken.address,
  ]);
}

export async function createExternalVesterDiscountCalculatorV1(
  veToken: VotingEscrow,
): Promise<ExternalVesterDiscountCalculatorV1> {
  return createContractWithAbi<ExternalVesterDiscountCalculatorV1>(
    ExternalVesterDiscountCalculatorV1__factory.abi,
    ExternalVesterDiscountCalculatorV1__factory.bytecode,
    getExternalVesterDiscountCalculatorConstructorParams(veToken),
  );
}

export async function createTestVeExternalVesterV1Proxy<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  pairToken: IERC20,
  pairMarketId: BigNumberish,
  paymentToken: IERC20,
  paymentMarketId: BigNumberish,
  rewardToken: IERC20,
  rewardMarketId: BigNumberish,
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
    getVeExternalVesterInitializationCalldata(oToken, baseUri, name, symbol),
  );
  const vesterProxy = await createContractWithAbi<UpgradeableProxy>(
    UpgradeableProxy__factory.abi,
    UpgradeableProxy__factory.bytecode,
    getUpgradeableProxyConstructorParams(implementation.address, implementationCalldata, core.dolomiteMargin),
  );
  return TestVeExternalVesterImplementationV1__factory.connect(vesterProxy.address, core.hhUser1);
}

export async function createTestOptionAirdropImplementation<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  dolo: DOLO,
): Promise<TestOptionAirdrop> {
  return createContractWithAbi<TestOptionAirdrop>(
    TestOptionAirdrop__factory.abi,
    TestOptionAirdrop__factory.bytecode,
    getOptionAirdropConstructorParams(core, dolo),
  );
}

export async function createTestOptionAirdrop<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  dolo: DOLO,
  treasury: string,
): Promise<TestOptionAirdrop> {
  const implementation = await createTestOptionAirdropImplementation(core, dolo);
  const calldata = await implementation.populateTransaction['initialize(address)'](treasury);
  const proxy = await createUpgradeableProxy(core, implementation, calldata);
  return TestOptionAirdrop__factory.connect(proxy.address, core.hhUser1);
}

export async function createOptionAirdropImplementation<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  dolo: DOLO,
): Promise<OptionAirdrop> {
  return createContractWithAbi<OptionAirdrop>(
    OptionAirdrop__factory.abi,
    OptionAirdrop__factory.bytecode,
    getOptionAirdropConstructorParams(core, dolo),
  );
}

export async function createOptionAirdrop<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  dolo: DOLO,
  treasury: string,
): Promise<OptionAirdrop> {
  const implementation = await createOptionAirdropImplementation(core, dolo);
  const calldata = await implementation.populateTransaction['initialize(address)'](treasury);
  const proxy = await createUpgradeableProxy(core, implementation, calldata);
  return OptionAirdrop__factory.connect(proxy.address, core.hhUser1);
}

export async function createRegularAirdropImplementation<T extends DolomiteNetwork>(
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

export async function createTestRegularAirdropImplementation<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  dolo: DOLO,
  veToken: VotingEscrow | MockVotingEscrow,
): Promise<TestRegularAirdrop> {
  return createContractWithAbi<TestRegularAirdrop>(
    TestRegularAirdrop__factory.abi,
    TestRegularAirdrop__factory.bytecode,
    getRegularAirdropConstructorParams(core, dolo, veToken),
  );
}

export async function createRegularAirdrop<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  dolo: DOLO,
  veToken: VotingEscrow | MockVotingEscrow,
): Promise<RegularAirdrop> {
  const implementation = await createRegularAirdropImplementation(core, dolo, veToken);
  const calldata = await implementation.populateTransaction.initialize();
  const proxy = await createUpgradeableProxy(core, implementation, calldata);
  return RegularAirdrop__factory.connect(proxy.address, core.hhUser1);
}

export async function createTestRegularAirdrop<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  dolo: DOLO,
  veToken: VotingEscrow | MockVotingEscrow,
): Promise<TestRegularAirdrop> {
  const implementation = await createTestRegularAirdropImplementation(core, dolo, veToken);
  const calldata = await implementation.populateTransaction.initialize();
  const proxy = await createUpgradeableProxy(core, implementation, calldata);
  return TestRegularAirdrop__factory.connect(proxy.address, core.hhUser1);
}

export async function createVestingClaimsImplementation<T extends DolomiteNetwork>(
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

export async function createVestingClaims<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  dolo: DOLO,
  tgeTimestamp: BigNumberish,
  duration: BigNumberish,
): Promise<VestingClaims> {
  const implementation = await createVestingClaimsImplementation(core, dolo, tgeTimestamp, duration);
  const calldata = await implementation.populateTransaction.initialize();
  const proxy = await createUpgradeableProxy(core, implementation, calldata);
  return VestingClaims__factory.connect(proxy.address, core.hhUser1);
}

export async function createStrategicVestingClaimsImplementation<T extends DolomiteNetwork>(
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

export async function createStrategicVestingClaims<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  dolo: DOLO,
  tgeTimestamp: BigNumberish,
  duration: BigNumberish,
): Promise<StrategicVestingClaims> {
  const implementation = await createStrategicVestingClaimsImplementation(core, dolo, tgeTimestamp, duration);
  const calldata = await implementation.populateTransaction.initialize();
  const proxy = await createUpgradeableProxy(core, implementation, calldata);
  return StrategicVestingClaims__factory.connect(proxy.address, core.hhUser1);
}

export async function createUpgradeableProxy<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  implementation: { address: string },
  calldata: PopulatedTransaction,
): Promise<UpgradeableProxy> {
  return createContractWithAbi<UpgradeableProxy>(
    UpgradeableProxy__factory.abi,
    UpgradeableProxy__factory.bytecode,
    getUpgradeableProxyConstructorParams(implementation.address, calldata, core.dolomiteMargin),
  );
}
