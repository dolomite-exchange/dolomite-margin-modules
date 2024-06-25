import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber, impersonate } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import hardhat from 'hardhat';
import { CHRONICLE_PRICE_SCRIBES_MAP } from 'packages/base/src/utils/constants';
import { TargetCollateralization, TargetLiquidationPenalty } from 'packages/base/src/utils/constructors/dolomite';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { IChronicleScribe__factory } from 'packages/oracles/src/types';
import {
  EncodedTransaction,
  prettyPrintEncodeAddMarket,
  prettyPrintEncodeInsertChainlinkOracleV3,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Lists USDM and rsETH
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  if (hardhat.network.name === 'hardhat') {
    const impersonator1 = await impersonate(core.delayedMultiSig.address, true);
    await core.delayedMultiSig.connect(impersonator1).changeTimeLock(0);
    console.log('\tTimelock skipped');

    const [owner1] = await core.delayedMultiSig.getOwners();
    const multisigOwner = await impersonate(owner1, true);
    await core.delayedMultiSig.connect(multisigOwner).executeMultipleTransactions([967, 968]);
    console.log('\tTransactions executed');

    const scribe = IChronicleScribe__factory.connect(
      CHRONICLE_PRICE_SCRIBES_MAP[network][core.tokens.usdm.address].scribeAddress,
      core.governance,
    );
    const toller = await impersonate((await scribe.authed())[0], true);
    const oracle = await impersonate(core.chroniclePriceOracleV3.address, true);
    await scribe.connect(toller).kiss(oracle.address);
  }

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    ...(await prettyPrintEncodeAddMarket(
      core,
      core.tokens.usdm,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction8L92U90OInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      parseEther(`${1_000_000}`),
      parseEther(`${800_000}`),
      false,
    )),
    ...(await prettyPrintEncodeInsertChainlinkOracleV3(core, core.tokens.rsEth, false)),
    ...(await prettyPrintEncodeAddMarket(
      core,
      core.tokens.rsEth,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction14L86U90OInterestSetter,
      TargetCollateralization._120,
      TargetLiquidationPenalty._6,
      parseEther(`${1_000}`),
      parseEther(`${800}`),
      false,
    )),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);
