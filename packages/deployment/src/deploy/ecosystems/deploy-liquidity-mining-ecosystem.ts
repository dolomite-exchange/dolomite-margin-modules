import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getUpgradeableProxyConstructorParams } from 'packages/base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, MAX_UINT_256_BI, Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from 'packages/deployment/src/utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from 'packages/deployment/src/utils/dry-run-utils';
import getScriptName from 'packages/deployment/src/utils/get-script-name';
import {
  getBuybackPoolConstructorParams,
  getExternalOARBConstructorParams,
  getExternalVesterDiscountCalculatorConstructorParams,
  getVeExternalVesterImplementationConstructorParams,
  getVeExternalVesterInitializationCalldata,
  getVeFeeCalculatorConstructorParams
} from 'packages/liquidity-mining/src/liquidity-mining-constructors';
import { ExternalOARB__factory, VeExternalVesterImplementationV1__factory, VotingEscrow__factory } from 'packages/liquidity-mining/src/types';

/**
 * This script encodes the following transactions:
 * - Deploys a new Custom Token with External Vester Implementation V2
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  // Deploy new custom token
  const customTokenAddress = await deployContractAndSave(
    'BurnableToken',
    [core.dolomiteMargin.address],
    'BurnableToken'
  );
  // @follow-up Will we be adding this token as a market to Dolomite?
  const customTokenMarketId = MAX_UINT_256_BI;

  // Deploy always active voter, oToken, veFeeCalculator, buybackPool
  const alwayActiveVoter = await deployContractAndSave(
    'VoterAlwaysActive',
    [],
    'VoterAlwaysActive'
  );
  const oTokenAddress = await deployContractAndSave(
    'ExternalOARB',
    getExternalOARBConstructorParams(core.governance.address, 'OToken', 'OT'),
    'ExternalOARB'
  );
  const oToken = ExternalOARB__factory.connect(oTokenAddress, core.hhUser1);

  const veFeeCalculator = await deployContractAndSave(
    'VeFeeCalculator',
    getVeFeeCalculatorConstructorParams(core),
    'VeFeeCalculator'
  );
  const buybackPool = await deployContractAndSave(
    'BuybackPool',
    getBuybackPoolConstructorParams(
      core,
      { address: customTokenAddress } as any,
      { address: oTokenAddress } as any
    ),
    'BuybackPool'
  );

  // Deploy VotingEscrow
  const votingEscrowImplementationAddress = await deployContractAndSave(
    'VotingEscrow',
    [],
    'VotingEscrowImplementation'
  );
  const votingEscrowImplementation = VotingEscrow__factory.connect(votingEscrowImplementationAddress, core.hhUser1);
  const initCalldata = await votingEscrowImplementation.populateTransaction.initialize(
    customTokenAddress,
    ADDRESS_ZERO,
    alwayActiveVoter,
    veFeeCalculator,
    ADDRESS_ZERO,
    buybackPool,
    core.governance.address
  );
  const votingEscrowProxyAddress = await deployContractAndSave(
    'UpgradeableProxy',
    getUpgradeableProxyConstructorParams(votingEscrowImplementationAddress, initCalldata, core.dolomiteMargin),
    'VotingEscrow'
  );
  const votingEscrow = VotingEscrow__factory.connect(votingEscrowProxyAddress, core.hhUser1);

  // Deploy Discount Calculator
  const discountCalculator = await deployContractAndSave(
    'ExternalVesterDiscountCalculatorV1',
    getExternalVesterDiscountCalculatorConstructorParams(votingEscrow),
    'ExternalVesterDiscountCalculatorV1'
  );

  // Deploy Vester
  const vesterImplementationAddress = await deployContractAndSave(
    'VeExternalVesterImplementationV1',
    getVeExternalVesterImplementationConstructorParams(
      core,
      { address: customTokenAddress } as any, // pairToken
      customTokenMarketId,
      core.tokens.weth, // paymentToken
      core.marketIds.weth,
      { address: customTokenAddress } as any, // rewardToken
      customTokenMarketId,
    ),
    'VeExternalVesterImplementationV1'
  );
  const vesterImplementation = VeExternalVesterImplementationV1__factory.connect(
    vesterImplementationAddress,
    core.hhUser1
  );
  const vesterInitCalldata = await vesterImplementation.populateTransaction.initialize(
    getVeExternalVesterInitializationCalldata(
      { address: discountCalculator } as any,
      { address: oTokenAddress } as any,
      'baseUri',
      'name',
      'SYMBOL'
    )
  );
  const vesterProxyAddress = await deployContractAndSave(
    'UpgradeableProxy',
    getUpgradeableProxyConstructorParams(vesterImplementationAddress, vesterInitCalldata, core.dolomiteMargin),
    'VeExternalVesterProxy'
  );
  const vester = VeExternalVesterImplementationV1__factory.connect(vesterProxyAddress, core.hhUser1);

  // Push admin transactions
  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [vester.address, true]
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { votingEscrow: votingEscrow },
      'votingEscrow',
      'setVester',
      [vesterProxyAddress]
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { vester: vester },
      'vester',
      'lazyInitialize',
      [votingEscrow.address]
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oToken: oToken },
      'oToken',
      'ownerSetHandler',
      [core.governance.address, true]
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oToken: oToken },
      'oToken',
      'ownerSetHandler',
      [vester.address, true]
    ),
    // @follow-up Not sure if we want to mint, deposit reward tokens, etc.
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
        await vester.PAYMENT_TOKEN() === core.tokens.weth.address &&
        await vester.REWARD_TOKEN() === customTokenAddress &&
        await vester.PAIR_TOKEN() === customTokenAddress,
        'Invalid vester token addresses'
      );
      assertHardhatInvariant(
        await vester.VE_TOKEN() === votingEscrowProxyAddress &&
        await vester.discountCalculator() === discountCalculator &&
        await vester.oToken() === oTokenAddress,
        'Invalid vester init addresses'
      );
      assertHardhatInvariant(
        await votingEscrow.vester() === vesterProxyAddress,
        'Invalid vester on votingEscrow'
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
