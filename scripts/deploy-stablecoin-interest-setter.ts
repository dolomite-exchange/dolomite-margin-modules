import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { Network } from 'src/utils/no-deps-constants';
import { setupCoreProtocol } from '../test/utils/setup';
import { deployContractAndSave, prettyPrintEncodedData } from './deploy-utils';

async function main() {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const core = await setupCoreProtocol({ network: chainId.toString() as Network, blockNumber: 0 });

  const lowerOptimal = BigNumber.from('80000000000000000');
  const upperOptimal = BigNumber.from('920000000000000000');
  const lower = lowerOptimal.toString().match(/^([1-9]+)/)![0];
  const upper = upperOptimal.toString().match(/^([1-9]+)/)![0];
  const stablecoinLinearInterestSetter = await deployContractAndSave(
    chainId,
    'LinearStepFunctionInterestSetter',
    [lowerOptimal, upperOptimal],
    `Stablecoin${lower}L${upper}ULinearStepFunctionInterestSetter`
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
