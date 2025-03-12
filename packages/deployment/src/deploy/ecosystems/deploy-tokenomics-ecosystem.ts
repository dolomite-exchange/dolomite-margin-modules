import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getUpgradeableProxyConstructorParams } from 'packages/base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, BYTES_EMPTY, MAX_UINT_256_BI, Network, NetworkType, ONE_DAY_SECONDS } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { deployContractAndSave } from 'packages/deployment/src/utils/deploy-utils';
import {
  doDryRunAndCheckDeployment,
  DryRunOutput,
  EncodedTransaction,
} from 'packages/deployment/src/utils/dry-run-utils';
import getScriptName from 'packages/deployment/src/utils/get-script-name';
import {
  getBuybackPoolConstructorParams,
  getExternalVesterDiscountCalculatorConstructorParams,
  getODOLOConstructorParams,
  getOptionAirdropConstructorParams,
  getRegularAirdropConstructorParams,
  getStrategicVestingClaimsConstructorParams,
  getVeExternalVesterImplementationConstructorParams,
  getVeExternalVesterInitializationCalldata,
  getVeFeeCalculatorConstructorParams,
  getVestingClaimsConstructorParams,
} from 'packages/tokenomics/src/tokenomics-constructors';
import {
  DOLO__factory,
  ODOLO__factory,
  OptionAirdrop__factory,
  RegularAirdrop__factory,
  StrategicVestingClaims__factory,
  VeExternalVesterImplementationV1__factory,
  VestingClaims__factory,
  VotingEscrow__factory,
} from 'packages/tokenomics/src/types';import { prettyPrintEncodedDataWithTypeSafety } from '../../utils/encoding/base-encoder-utils';

const NO_MARKET_ID = MAX_UINT_256_BI;
const TGE_TIMESTAMP = 2222222222;
const ONE_YEAR_SECONDS = 365 * ONE_DAY_SECONDS;
const THREE_YEARS_SECONDS = ONE_YEAR_SECONDS * 3;

/**
 * This script encodes the following transactions:
 * - Deploys DOLO tokenomics
 * - Deploys the airdrop contracts
 */
async function main<T extends NetworkType>(): Promise<DryRunOutput<T>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = (await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  })) as any;

  // Deploy new custom token
  const doloAddress = await deployContractAndSave('DOLO', [core.dolomiteMargin.address, core.gnosisSafeAddress],
    'DOLO',
  );
  const dolo = DOLO__factory.connect(doloAddress, core.hhUser1);

  // Deploy always active voter, oToken, veFeeCalculator, buybackPool
  const alwaysActiveVoter = await deployContractAndSave('VoterAlwaysActive', [], 'VoterAlwaysActive');
  const oDoloAddress = await deployContractAndSave('ODOLO', getODOLOConstructorParams(core), 'oDOLO');
  const oDolo = ODOLO__factory.connect(oDoloAddress, core.hhUser1);

  const veFeeCalculator = await deployContractAndSave(
    'VeFeeCalculator',
    getVeFeeCalculatorConstructorParams(core),
    'VeFeeCalculator',
  );
  const buybackPool = await deployContractAndSave(
    'BuybackPool',
    getBuybackPoolConstructorParams(core, { address: doloAddress } as any, { address: oDoloAddress } as any),
    'BuybackPool',
  );

  // Deploy VotingEscrow
  const votingEscrowImplementationAddress = await deployContractAndSave(
    'VotingEscrow',
    [],
    'VotingEscrowImplementationV1',
  );
  const votingEscrowImplementation = VotingEscrow__factory.connect(votingEscrowImplementationAddress, core.hhUser1);
  const initCalldata = await votingEscrowImplementation.populateTransaction.initialize(
    doloAddress,
    ADDRESS_ZERO, // art_proxy
    alwaysActiveVoter,
    veFeeCalculator,
    ADDRESS_ZERO, // vester
    buybackPool,
    core.governance.address,
  );
  const votingEscrowProxyAddress = await deployContractAndSave(
    'UpgradeableProxy',
    getUpgradeableProxyConstructorParams(votingEscrowImplementationAddress, initCalldata, core.dolomiteMargin),
    'VotingEscrow',
  );
  const votingEscrow = VotingEscrow__factory.connect(votingEscrowProxyAddress, core.hhUser1);

  // Deploy Discount Calculator
  const discountCalculator = await deployContractAndSave(
    'ExternalVesterDiscountCalculatorV1',
    getExternalVesterDiscountCalculatorConstructorParams(votingEscrow),
    'ExternalVesterDiscountCalculatorV1',
  );

  // Deploy Vester
  const vesterImplementationAddress = await deployContractAndSave(
    'VeExternalVesterImplementationV1',
    getVeExternalVesterImplementationConstructorParams(
      core,
      { address: doloAddress } as any, // pairToken
      NO_MARKET_ID,
      core.tokens.weth, // paymentToken
      core.marketIds.weth,
      { address: doloAddress } as any, // rewardToken
      NO_MARKET_ID,
    ),
    'VeExternalVesterImplementationV1',
  );
  const vesterImplementation = VeExternalVesterImplementationV1__factory.connect(
    vesterImplementationAddress,
    core.hhUser1,
  );
  const vesterInitCalldata = await vesterImplementation.populateTransaction.initialize(
    getVeExternalVesterInitializationCalldata(
      { address: discountCalculator } as any,
      { address: oDoloAddress } as any,
      'baseUri', // @todo update these
      'Dolomite oDOLO Vesting',
      'voDOLO',
    ),
  );
  const vesterProxyAddress = await deployContractAndSave(
    'UpgradeableProxy',
    getUpgradeableProxyConstructorParams(vesterImplementationAddress, vesterInitCalldata, core.dolomiteMargin),
    'VeExternalVesterProxy',
  );
  const vester = VeExternalVesterImplementationV1__factory.connect(vesterProxyAddress, core.hhUser1);

  const optionAirdropAddress = await deployContractAndSave(
    'OptionAirdrop',
    getOptionAirdropConstructorParams(core, dolo),
    'OptionAirdropImplementationV1'
  );
  const optionAirdropImplementation = OptionAirdrop__factory.connect(optionAirdropAddress, core.hhUser1);
  const optionAirdropInitCalldata = await optionAirdropImplementation.populateTransaction.initialize(
    core.gnosisSafeAddress // @follow-up Confirm that this is the correct treasury address
  );
  const optionAirdropProxyAddress = await deployContractAndSave(
    'UpgradeableProxy',
    getUpgradeableProxyConstructorParams(optionAirdropAddress, optionAirdropInitCalldata, core.dolomiteMargin),
    'OptionAirdrop',
  );
  const optionAirdrop = OptionAirdrop__factory.connect(optionAirdropProxyAddress, core.hhUser1);

  const regularAirdropAddress = await deployContractAndSave(
    'RegularAirdrop',
    getRegularAirdropConstructorParams(core, dolo, votingEscrow),
    'RegularAirdropImplementationV1'
  );
  const regularAirdropProxyAddress = await deployContractAndSave(
    'UpgradeableProxy',
    getUpgradeableProxyConstructorParams(regularAirdropAddress, null, core.dolomiteMargin),
    'RegularAirdrop',
  );
  const regularAirdrop = RegularAirdrop__factory.connect(regularAirdropProxyAddress, core.hhUser1);

  const vestingClaimsAddress = await deployContractAndSave(
    'VestingClaims',
    getVestingClaimsConstructorParams(core, dolo, TGE_TIMESTAMP, THREE_YEARS_SECONDS),
    'VestingClaimsImplementationV1'
  );
  const vestingClaimsProxyAddress = await deployContractAndSave(
    'UpgradeableProxy',
    getUpgradeableProxyConstructorParams(vestingClaimsAddress, null, core.dolomiteMargin),
    'VestingClaims',
  );
  const vestingClaims = VestingClaims__factory.connect(vestingClaimsProxyAddress, core.hhUser1);

  const strategicVestingAddress = await deployContractAndSave(
    'StrategicVesting',
    getStrategicVestingClaimsConstructorParams(core, dolo, TGE_TIMESTAMP, ONE_YEAR_SECONDS),
    'StrategicVestingImplementationV1'
  );
  const strategicVestingProxyAddress = await deployContractAndSave(
    'UpgradeableProxy',
    getUpgradeableProxyConstructorParams(strategicVestingAddress, null, core.dolomiteMargin),
    'StrategicVesting',
  );
  const strategicVesting = StrategicVestingClaims__factory.connect(strategicVestingProxyAddress, core.hhUser1);

  // Push admin transactions
  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      vester.address,
      true,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      optionAirdrop.address,
      true,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, { votingEscrow: votingEscrow }, 'votingEscrow', 'setVester', [
      vesterProxyAddress,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, { vester: vester }, 'vester', 'lazyInitialize', [
      votingEscrow.address,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, { oToken: oDolo }, 'oToken', 'ownerSetHandler', [
      core.governance.address,
      true,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, { oToken: oDolo }, 'oToken', 'ownerSetHandler', [
      vester.address,
      true,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, { optionAirdrop }, 'optionAirdrop', 'ownerSetHandler', [
      core.gnosisSafeAddress
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, { regularAirdrop }, 'regularAirdrop', 'ownerSetHandler', [
      core.gnosisSafeAddress
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, { vestingClaims }, 'vestingClaims', 'ownerSetHandler', [
      core.gnosisSafeAddress
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, { strategicVesting }, 'strategicVesting', 'ownerSetHandler', [
      core.gnosisSafeAddress
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, { optionAirdrop }, 'optionAirdrop', 'ownerSetAllowedMarketIds', [
      [core.marketIds.nativeUsdc, core.marketIds.weth], // @follow-up Check this list of market ids and invariants below
    ]),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: network,
    },
    invariants: async () => {
      assertHardhatInvariant(
        (await vester.PAYMENT_TOKEN()) === core.tokens.weth.address &&
          (await vester.REWARD_TOKEN()) === doloAddress &&
          (await vester.PAIR_TOKEN()) === doloAddress,
        'Invalid vester token addresses',
      );
      assertHardhatInvariant(
        (await vester.VE_TOKEN()) === votingEscrowProxyAddress &&
          (await vester.discountCalculator()) === discountCalculator &&
          (await vester.oToken()) === oDoloAddress,
        'Invalid vester init addresses',
      );
      assertHardhatInvariant((await votingEscrow.vester()) === vesterProxyAddress, 'Invalid vester on votingEscrow');

      assertHardhatInvariant((await core.dolomiteMargin.getIsGlobalOperator(vester.address)) === true, 'Vester is not a global operator');
      assertHardhatInvariant((await core.dolomiteMargin.getIsGlobalOperator(optionAirdrop.address)) === true, 'OptionAirdrop is not a global operator');

      assertHardhatInvariant(await optionAirdrop.handler() === core.gnosisSafeAddress, 'Invalid handler on optionAirdrop');
      assertHardhatInvariant(await regularAirdrop.handler() === core.gnosisSafeAddress, 'Invalid handler on regularAirdrop');
      assertHardhatInvariant(await vestingClaims.handler() === core.gnosisSafeAddress, 'Invalid handler on vestingClaims');
      assertHardhatInvariant(await strategicVesting.handler() === core.gnosisSafeAddress, 'Invalid handler on strategicVesting');

      assertHardhatInvariant(await optionAirdrop.isAllowedMarketId(core.marketIds.nativeUsdc), 'Native USDC not allowed');
      assertHardhatInvariant(await optionAirdrop.isAllowedMarketId(core.marketIds.weth), 'WETH not allowed');
    },
  };
}

doDryRunAndCheckDeployment(main);
