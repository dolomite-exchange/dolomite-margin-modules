import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { FinalSettlementViaInternalSwapProxy__factory } from '../../../../../../base/src/types';
import { expectProtocolBalance } from '../../../../../../base/test/utils/assertions';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import ModulesDeployment from '../../../deployments.json';
import JusdcSuppliers from './jusdc-suppliers.json';

const CURSOR = 3;

/**
 * This script encodes the following transactions:
 * - Execute final settlement against chunked positions
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const finalSettlement = FinalSettlementViaInternalSwapProxy__factory.connect(
    ModulesDeployment.FinalSettlementViaInternalSwapProxyV1[network].address,
    core.hhUser1,
  );

  const allBorrowers = JusdcSuppliers.filter((j) =>
    j.debtMarkets.some((m) => BigNumber.from(m).eq(core.marketIds.usdc)),
  );
  console.log('JusdcSuppliers', allBorrowers.length);
  const borrowers = allBorrowers
    .map((b) => ({
      owner: b.owner,
      number: b.number,
    }))
    .slice(CURSOR * 34, (CURSOR + 1) * 34);
  const usdcSuppliers = borrowers.map(() => ({
    owner: '0x1fF6B8E1192eB0369006Bbad76dA9068B68961B2',
    number: BigNumber.from('43287597463652610515776048249960222426297783800506298849863681408039822024105'),
  }));

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(core, { finalSettlement }, 'finalSettlement', 'ownerSettle', [
      borrowers,
      usdcSuppliers,
      core.marketIds.usdc,
      core.marketIds.djUsdcV2,
      { value: parseEther(`${0.001}`) },
    ]),
  ];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
      logGasUsage: true,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    invariants: async () => {
      for (const supplyAccount of borrowers) {
        await expectProtocolBalance(core, supplyAccount.owner, supplyAccount.number, core.marketIds.djUsdcV2, ZERO_BI);
      }
    },
  };
}

doDryRunAndCheckDeployment(main);
