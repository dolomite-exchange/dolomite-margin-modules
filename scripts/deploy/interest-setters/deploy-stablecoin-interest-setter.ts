import { BigNumber } from 'ethers';
import { getAnyNetwork } from '../../../packages/base/src/utils/dolomite-utils';
import { setupCoreProtocol } from '../../../packages/base/test/utils/setup';
import { deployContractAndSave, prettyPrintEncodedDataWithTypeSafety } from '../../deploy-utils';

async function main() {
  const network = await getAnyNetwork();
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const stableLowerOptimal = BigNumber.from('80000000000000000');
  const stableUpperOptimal = BigNumber.from('920000000000000000');
  const stableLower = stableLowerOptimal.toString().match(/^([1-9]+)/)![0];
  const stableUpper = stableUpperOptimal.toString().match(/^([1-9]+)/)![0];
  const stablecoinLinearInterestSetter = await deployContractAndSave(
    Number(network),
    'LinearStepFunctionInterestSetter',
    [stableLowerOptimal, stableUpperOptimal],
    `Stablecoin${stableLower}L${stableUpper}ULinearStepFunctionInterestSetter`,
  );
  const altcoinLowerOptimal = BigNumber.from('140000000000000000');
  const altcoinUpperOptimal = BigNumber.from('860000000000000000');
  const altcoinLower = altcoinLowerOptimal.toString().match(/^([1-9]+)/)![0];
  const altcoinUpper = altcoinUpperOptimal.toString().match(/^([1-9]+)/)![0];
  await deployContractAndSave(
    Number(network),
    'LinearStepFunctionInterestSetter',
    [altcoinLowerOptimal, altcoinUpperOptimal],
    `Altcoin${altcoinLower}L${altcoinUpper}ULinearStepFunctionInterestSetter`,
  );

  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'dolomiteMargin',
    'ownerSetInterestSetter',
    [
      core.marketIds.usdc!,
      stablecoinLinearInterestSetter,
    ],
  );
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'dolomiteMargin',
    'ownerSetInterestSetter',
    [
      core.marketIds.usdt!,
      stablecoinLinearInterestSetter,
    ],
  );
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'dolomiteMargin',
    'ownerSetInterestSetter',
    [
      core.marketIds.dai!,
      stablecoinLinearInterestSetter,
    ],
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
