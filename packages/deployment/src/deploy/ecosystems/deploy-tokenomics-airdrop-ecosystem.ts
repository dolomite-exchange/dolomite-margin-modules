import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getUpgradeableProxyConstructorParams } from 'packages/base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network, ONE_DAY_SECONDS } from 'packages/base/src/utils/no-deps-constants';
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
  getOptionAirdropConstructorParams,
  getRegularAirdropConstructorParams,
  getStrategicVestingClaimsConstructorParams,
  getVestingClaimsConstructorParams,
} from 'packages/tokenomics/src/tokenomics-constructors';
import {
  OptionAirdrop__factory,
  RegularAirdrop__factory,
  StrategicVestingClaims__factory,
  VestingClaims__factory,
} from 'packages/tokenomics/src/types';
import { prettyPrintEncodedDataWithTypeSafety } from '../../utils/encoding/base-encoder-utils';

const TGE_TIMESTAMP = 1745496000;
const ONE_YEAR_SECONDS = 365 * ONE_DAY_SECONDS;
const THREE_YEARS_SECONDS = ONE_YEAR_SECONDS * 3;

const OPTION_AIRDROP_MERKLE_ROOT = '0xea62ba20f90986e03792f67bdd49d0b63f4895c413aacc52110f92aed8df1d3e';
const REGULAR_AIRDROP_MERKLE_ROOT = '0x40c2944667a515db4f206498e199c149602bd65a817ac59dc47bfeb38ded6294';

/**
 * This script encodes the following transactions:
 * - Deploys the airdrop contracts
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const dolo = core.tokenomics.dolo;
  const votingEscrow = core.tokenomics.veDolo;

  const optionAirdropAddress = await deployContractAndSave(
    'OptionAirdrop',
    getOptionAirdropConstructorParams(core, dolo),
    'OptionAirdropImplementationV1',
  );
  const optionAirdropImplementation = OptionAirdrop__factory.connect(optionAirdropAddress, core.hhUser1);
  const optionAirdropInitCalldata = await optionAirdropImplementation.populateTransaction['initialize(address)'](
    core.gnosisSafeAddress,
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
    'RegularAirdropImplementationV1',
  );
  const regularAirdropImplementation = RegularAirdrop__factory.connect(regularAirdropAddress, core.hhUser1);
  const regularAirdropProxyAddress = await deployContractAndSave(
    'UpgradeableProxy',
    getUpgradeableProxyConstructorParams(
      regularAirdropAddress,
      await regularAirdropImplementation.populateTransaction.initialize(),
      core.dolomiteMargin,
    ),
    'RegularAirdrop',
  );
  const regularAirdrop = RegularAirdrop__factory.connect(regularAirdropProxyAddress, core.hhUser1);

  const vestingClaimsAddress = await deployContractAndSave(
    'VestingClaims',
    getVestingClaimsConstructorParams(core, dolo, TGE_TIMESTAMP, THREE_YEARS_SECONDS),
    'VestingClaimsImplementationV1',
  );
  const vestingClaimsImplementation = VestingClaims__factory.connect(vestingClaimsAddress, core.hhUser1);
  const vestingClaimsProxyAddress = await deployContractAndSave(
    'UpgradeableProxy',
    getUpgradeableProxyConstructorParams(
      vestingClaimsAddress,
      await vestingClaimsImplementation.populateTransaction.initialize(),
      core.dolomiteMargin,
    ),
    'VestingClaimsProxy',
  );
  const vestingClaims = VestingClaims__factory.connect(vestingClaimsProxyAddress, core.hhUser1);

  const advisorClaimsAddress = await deployContractAndSave(
    'VestingClaims',
    getVestingClaimsConstructorParams(core, dolo, TGE_TIMESTAMP, THREE_YEARS_SECONDS),
    'VestingClaimsImplementationV1',
  );
  const advisorClaimsImplementation = VestingClaims__factory.connect(advisorClaimsAddress, core.hhUser1);
  const advisorClaimsProxyAddress = await deployContractAndSave(
    'UpgradeableProxy',
    getUpgradeableProxyConstructorParams(
      advisorClaimsAddress,
      await advisorClaimsImplementation.populateTransaction.initialize(),
      core.dolomiteMargin,
    ),
    'AdvisorClaimsProxy',
  );
  const advisorClaims = VestingClaims__factory.connect(advisorClaimsProxyAddress, core.hhUser1);

  const strategicVestingAddress = await deployContractAndSave(
    'StrategicVestingClaims',
    getStrategicVestingClaimsConstructorParams(core, dolo, TGE_TIMESTAMP, ONE_YEAR_SECONDS),
    'StrategicVestingImplementationV1',
  );
  const strategicVestingImplementation = StrategicVestingClaims__factory.connect(strategicVestingAddress, core.hhUser1);
  const strategicVestingProxyAddress = await deployContractAndSave(
    'UpgradeableProxy',
    getUpgradeableProxyConstructorParams(
      strategicVestingAddress,
      await strategicVestingImplementation.populateTransaction.initialize(),
      core.dolomiteMargin,
    ),
    'StrategicVestingProxy',
  );
  const strategicVesting = StrategicVestingClaims__factory.connect(strategicVestingProxyAddress, core.hhUser1);

  // Push admin transactions
  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      optionAirdrop.address,
      true,
    ]),

    await prettyPrintEncodedDataWithTypeSafety(core, { optionAirdrop }, 'optionAirdrop', 'ownerSetHandler', [
      core.gnosisSafeAddress,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, { regularAirdrop }, 'regularAirdrop', 'ownerSetHandler', [
      core.gnosisSafeAddress,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, { vestingClaims }, 'vestingClaims', 'ownerSetHandler', [
      core.gnosisSafeAddress,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, { strategicVesting }, 'strategicVesting', 'ownerSetHandler', [
      core.gnosisSafeAddress,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, { advisorClaims }, 'advisorClaims', 'ownerSetHandler', [
      core.gnosisSafeAddress,
    ]),

    await prettyPrintEncodedDataWithTypeSafety(core, { optionAirdrop }, 'optionAirdrop', 'ownerSetAllowedMarketIds', [
      [core.marketIds.honey, core.marketIds.usdc, core.marketIds.usdt],
    ]),

    await prettyPrintEncodedDataWithTypeSafety(core, { optionAirdrop }, 'optionAirdrop', 'ownerSetMerkleRoot', [
      OPTION_AIRDROP_MERKLE_ROOT,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, { regularAirdrop }, 'regularAirdrop', 'ownerSetMerkleRoot', [
      REGULAR_AIRDROP_MERKLE_ROOT,
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
        await core.dolomiteMargin.getIsGlobalOperator(optionAirdrop.address),
        'OptionAirdrop is not a global operator',
      );

      assertHardhatInvariant(
        (await optionAirdrop.handler()) === core.gnosisSafeAddress,
        'Invalid handler on optionAirdrop',
      );
      assertHardhatInvariant(
        (await regularAirdrop.handler()) === core.gnosisSafeAddress,
        'Invalid handler on regularAirdrop',
      );
      assertHardhatInvariant(
        (await vestingClaims.handler()) === core.gnosisSafeAddress,
        'Invalid handler on vestingClaims',
      );
      assertHardhatInvariant(
        (await strategicVesting.handler()) === core.gnosisSafeAddress,
        'Invalid handler on strategicVesting',
      );
      assertHardhatInvariant(
        (await advisorClaims.handler()) === core.gnosisSafeAddress,
        'Invalid handler on advisorClaims',
      );

      assertHardhatInvariant(await optionAirdrop.isAllowedMarketId(core.marketIds.honey), 'HONEY not allowed');
      assertHardhatInvariant(await optionAirdrop.isAllowedMarketId(core.marketIds.usdc), 'USDC not allowed');
      assertHardhatInvariant(await optionAirdrop.isAllowedMarketId(core.marketIds.usdt), 'USDT not allowed');

      assertHardhatInvariant(
        (await optionAirdrop.merkleRoot()) === OPTION_AIRDROP_MERKLE_ROOT,
        'Invalid option merkle root',
      );
      assertHardhatInvariant(
        (await regularAirdrop.merkleRoot()) === REGULAR_AIRDROP_MERKLE_ROOT,
        'Invalid regular merkle root',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
