import { createContractWithAbi, createContractWithLibrary, createContractWithName } from "packages/base/src/utils/dolomite-utils";
import { DOLO, DOLO__factory, ExternalVesterDiscountCalculatorV1, IERC20, IVesterDiscountCalculator, MockVotingEscrow, ODOLO, ODOLO__factory, OptionAirdrop, OptionAirdrop__factory, RegularAirdrop, RegularAirdrop__factory, TestVeExternalVesterImplementationV1, TestVeExternalVesterImplementationV1__factory, UpgradeableProxy, UpgradeableProxy__factory, VeFeeCalculator, VeFeeCalculator__factory, VotingEscrow, VotingEscrow__factory } from "../src/types";
import { ADDRESS_ZERO, NetworkType } from "packages/base/src/utils/no-deps-constants";
import { CoreProtocolType } from "packages/base/test/utils/setup";
import { getDOLOConstructorParams, getExternalVesterDiscountCalculatorConstructorParams, getODOLOConstructorParams, getOptionAirdropConstructorParams, getRegularAirdropConstructorParams, getVeExternalVesterImplementationConstructorParams, getVeExternalVesterInitializationCalldata, getVeFeeCalculatorConstructorParams } from "../src/tokenomics-constructors";
import { SignerWithAddressWithSafety } from "packages/base/src/utils/SignerWithAddressWithSafety";
import { BigNumberish } from "ethers";
import { getUpgradeableProxyConstructorParams } from "packages/base/src/utils/constructors/dolomite";
import { ExternalVesterDiscountCalculatorV1__factory } from "packages/liquidity-mining/src/types";
import { get } from "http";

export async function createDOLO<T extends NetworkType>(
  core: CoreProtocolType<T>
): Promise<DOLO> {
  return createContractWithAbi<DOLO>(
    DOLO__factory.abi,
    DOLO__factory.bytecode,
    getDOLOConstructorParams(core)
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
    getUpgradeableProxyConstructorParams(implementation.address, initializeCalldata, core.dolomiteMargin),
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
    getUpgradeableProxyConstructorParams(implementation.address, implementationCalldata, core.dolomiteMargin),
  );
  return TestVeExternalVesterImplementationV1__factory.connect(vesterProxy.address, core.hhUser1);
}

export async function createOptionAirdrop<T extends NetworkType>(
  core: CoreProtocolType<T>,
  dolo: DOLO,
): Promise<OptionAirdrop> {
  return createContractWithAbi<OptionAirdrop>(
    OptionAirdrop__factory.abi,
    OptionAirdrop__factory.bytecode,
    getOptionAirdropConstructorParams(core, dolo),
  );
}

export async function createRegularAirdrop<T extends NetworkType>(
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