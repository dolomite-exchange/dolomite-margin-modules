import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getUpgradeableProxyConstructorParams } from 'packages/base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, MAX_UINT_256_BI, Network, NetworkType } from 'packages/base/src/utils/no-deps-constants';
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
  getVeExternalVesterImplementationConstructorParams,
  getVeExternalVesterInitializationCalldata,
  getVeFeeCalculatorConstructorParams,
} from 'packages/tokenomics/src/tokenomics-constructors';
import {
  ODOLO__factory,
  VeExternalVesterImplementationV1__factory,
  VotingEscrow__factory,
} from 'packages/tokenomics/src/types';
import { prettyPrintEncodedDataWithTypeSafety } from '../../utils/encoding/base-encoder-utils';

const NO_MARKET_ID = MAX_UINT_256_BI;

/**
 * This script encodes the following transactions:
 * - Deploys DOLO tokenomics
 */
async function main<T extends NetworkType>(): Promise<DryRunOutput<T>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = (await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  })) as any;

  // Deploy new custom token
  const doloAddress = await deployContractAndSave('DOLO', [core.dolomiteMargin.address], 'DOLO');

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
      'name',
      'SYMBOL',
    ),
  );
  const vesterProxyAddress = await deployContractAndSave(
    'UpgradeableProxy',
    getUpgradeableProxyConstructorParams(vesterImplementationAddress, vesterInitCalldata, core.dolomiteMargin),
    'VeExternalVesterProxy',
  );
  const vester = VeExternalVesterImplementationV1__factory.connect(vesterProxyAddress, core.hhUser1);

  // Push admin transactions
  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      vester.address,
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
    // @follow-up Not sure if we want to mint, deposit reward tokens, deploy airdrop contracts, etc
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
    },
  };
}

doDryRunAndCheckDeployment(main);
