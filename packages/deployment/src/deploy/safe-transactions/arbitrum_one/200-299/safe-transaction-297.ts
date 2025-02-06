import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { JonesUSDCIsolationModeTokenVaultV1__factory } from '@dolomite-exchange/modules-jones/src/types';
import { expect } from 'chai';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

const AAVE_STABLECOIN = '0xEA4E670fD64aE82af5a3d77b3Db6b5E28A5522de';
const AAVE_ALTCOIN = '0xc2cBd99bb35b22C43010a8c8266Cdff057f70BB1';

/**
 * This script encodes the following transactions:
 * - Removes any usage of the AAVE stablecoin and altcoin interest setters
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });
  const marketsLength = await core.dolomiteMargin.getNumMarkets();

  const transactions: EncodedTransaction[] = [];
  for (let i = 0; i < marketsLength.toNumber(); i++) {
    const interestSetterAddress = await core.dolomiteMargin.getMarketInterestSetter(i);
    let remappedInterestSetterAddress: string | undefined;
    if (interestSetterAddress === AAVE_STABLECOIN) {
      remappedInterestSetterAddress = core.interestSetters.linearStepFunction16L84U90OInterestSetter.address;
    } else if (interestSetterAddress === AAVE_ALTCOIN) {
      remappedInterestSetterAddress = core.interestSetters.linearStepFunction14L86U90OInterestSetter.address;
    }

    if (remappedInterestSetterAddress) {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          { dolomite: core.dolomiteMargin },
          'dolomite',
          'ownerSetInterestSetter',
          [i, remappedInterestSetterAddress],
        ),
      );
    }
  }
  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    skipTimeDelay: true,
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);
