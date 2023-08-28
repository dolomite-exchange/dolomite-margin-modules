import { BigNumber } from 'ethers';
import { getAnyNetwork } from '../../../src/utils/dolomite-utils';
import { setupCoreProtocol } from '../../../test/utils/setup';
import { deployContractAndSave, prettyPrintEncodedData } from '../../deploy-utils';

async function main() {
  const network = await getAnyNetwork();
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const lowerOptimal = BigNumber.from('80000000000000000');
  const upperOptimal = BigNumber.from('920000000000000000');
  const lower = lowerOptimal.toString().match(/^([1-9]+)/)![0];
  const upper = upperOptimal.toString().match(/^([1-9]+)/)![0];
  const stablecoinLinearInterestSetter = await deployContractAndSave(
    Number(network),
    'LinearStepFunctionInterestSetter',
    [lowerOptimal, upperOptimal],
    `Stablecoin${lower}L${upper}ULinearStepFunctionInterestSetter`,
  );

  await prettyPrintEncodedData(
    core.dolomiteMargin!.populateTransaction.ownerSetInterestSetter(
      core.marketIds.usdc!,
      stablecoinLinearInterestSetter,
    ),
    'dolomiteMargin.ownerSetInterestSetter(usdc, stablecoinLinearInterestSetter)',
  );
  await prettyPrintEncodedData(
    core.dolomiteMargin!.populateTransaction.ownerSetInterestSetter(
      core.marketIds.usdt!,
      stablecoinLinearInterestSetter,
    ),
    'dolomiteMargin.ownerSetInterestSetter(usdt, stablecoinLinearInterestSetter)',
  );
  await prettyPrintEncodedData(
    core.dolomiteMargin!.populateTransaction.ownerSetInterestSetter(
      core.marketIds.dai!,
      stablecoinLinearInterestSetter,
    ),
    'dolomiteMargin.ownerSetInterestSetter(dai, stablecoinLinearInterestSetter)',
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
