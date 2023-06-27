import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { Network } from 'src/utils/no-deps-constants';
import { setupCoreProtocol } from '../test/utils/setup';
import { deployContractAndSave, prettyPrintEncodedData } from './deploy-utils';

async function main() {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const core = await setupCoreProtocol({ network: chainId.toString() as Network, blockNumber: 0 });

  const lowerOptimal = BigNumber.from('60000000000000000');
  const upperOptimal = BigNumber.from('940000000000000000');
  const stablecoinLinearInterestSetter = await deployContractAndSave(
    chainId,
    'LinearStepFunctionInterestSetter',
    [lowerOptimal, upperOptimal],
    'StablecoinLinearStepFunctionInterestSetter'
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
