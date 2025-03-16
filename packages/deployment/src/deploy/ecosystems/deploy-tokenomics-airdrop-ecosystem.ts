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

const TGE_TIMESTAMP = 2222222222;
const ONE_YEAR_SECONDS = 365 * ONE_DAY_SECONDS;
const THREE_YEARS_SECONDS = ONE_YEAR_SECONDS * 3;

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
  const regularAirdropProxyAddress = await deployContractAndSave(
    'UpgradeableProxy',
    getUpgradeableProxyConstructorParams(regularAirdropAddress, null, core.dolomiteMargin),
    'RegularAirdrop',
  );
  const regularAirdrop = RegularAirdrop__factory.connect(regularAirdropProxyAddress, core.hhUser1);

  const vestingClaimsAddress = await deployContractAndSave(
    'VestingClaims',
    getVestingClaimsConstructorParams(core, dolo, TGE_TIMESTAMP, THREE_YEARS_SECONDS),
    'VestingClaimsImplementationV1',
  );
  const vestingClaimsProxyAddress = await deployContractAndSave(
    'UpgradeableProxy',
    getUpgradeableProxyConstructorParams(vestingClaimsAddress, null, core.dolomiteMargin),
    'VestingClaimsProxy',
  );
  const vestingClaims = VestingClaims__factory.connect(vestingClaimsProxyAddress, core.hhUser1);

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
    await prettyPrintEncodedDataWithTypeSafety(core, { optionAirdrop }, 'optionAirdrop', 'ownerSetAllowedMarketIds', [
      [core.marketIds.honey, core.marketIds.usdc, core.marketIds.usdt],
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

      assertHardhatInvariant(await optionAirdrop.isAllowedMarketId(core.marketIds.honey), 'HONEY not allowed');
      assertHardhatInvariant(await optionAirdrop.isAllowedMarketId(core.marketIds.usdc), 'USDC not allowed');
      assertHardhatInvariant(await optionAirdrop.isAllowedMarketId(core.marketIds.usdt), 'USDT not allowed');
    },
  };
}

doDryRunAndCheckDeployment(main);
