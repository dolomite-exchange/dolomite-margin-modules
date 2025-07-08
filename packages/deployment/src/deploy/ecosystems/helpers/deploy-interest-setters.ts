import { parseEther } from 'ethers/lib/utils';
import { getLinearStepFunctionInterestSetterConstructorParams } from 'packages/interest-setters/src/interest-setters-constructors';
import { IDolomiteMargin, IDolomiteMarginV2 } from '../../../../../base/src/types';
import { Network } from '../../../../../base/src/utils/no-deps-constants';
import { deployContractAndSave } from '../../../utils/deploy-utils';

export async function deployInterestSetters<T extends Network>(
  network: T,
  dolomiteMargin: IDolomiteMargin | IDolomiteMarginV2,
): Promise<void> {
  if (network === Network.Ethereum || network === Network.Botanix) {
    await deployContractAndSave(
      'ModularLinearStepFunctionInterestSetter',
      [dolomiteMargin.address],
    );
    return;
  }

  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.04'), parseEther('0.96'), parseEther('0.70')),
    'LinearStepFunction4L96U70OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.04'), parseEther('0.96'), parseEther('0.80')),
    'LinearStepFunction4L96U80OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.04'), parseEther('0.96'), parseEther('0.90')),
    'LinearStepFunction4L96U90OInterestSetter',
  );

  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.06'), parseEther('0.94'), parseEther('0.70')),
    'LinearStepFunction6L94U70OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.06'), parseEther('0.94'), parseEther('0.80')),
    'LinearStepFunction6L94U80OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.06'), parseEther('0.94'), parseEther('0.90')),
    'LinearStepFunction6L94U90OInterestSetter',
  );

  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.07'), parseEther('0.93'), parseEther('0.90')),
    'LinearStepFunction7L93U90OInterestSetter',
  );

  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.08'), parseEther('0.92'), parseEther('0.70')),
    'LinearStepFunction8L92U70OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.08'), parseEther('0.92'), parseEther('0.80')),
    'LinearStepFunction8L92U80OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.08'), parseEther('0.92'), parseEther('0.90')),
    'LinearStepFunction8L92U90OInterestSetter',
  );

  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.10'), parseEther('0.90'), parseEther('0.90')),
    'LinearStepFunction10L90U90OInterestSetter',
  );

  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.10'), parseEther('0.90'), parseEther('0.95')),
    'LinearStepFunction10L90U95OInterestSetter',
  );

  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.12'), parseEther('0.88'), parseEther('0.90')),
    'LinearStepFunction12L88U90OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.12'), parseEther('0.88'), parseEther('0.95')),
    'LinearStepFunction12L88U95OInterestSetter',
  );

  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.14'), parseEther('0.86'), parseEther('0.90')),
    'LinearStepFunction14L86U90OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.14'), parseEther('0.86'), parseEther('0.95')),
    'LinearStepFunction14L86U95OInterestSetter',
  );

  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.15'), parseEther('1.35'), parseEther('0.60')),
    'LinearStepFunction15L135U60OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.15'), parseEther('1.35'), parseEther('0.70')),
    'LinearStepFunction15L135U70OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.15'), parseEther('1.35'), parseEther('0.75')),
    'LinearStepFunction15L135U75OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.15'), parseEther('1.35'), parseEther('0.80')),
    'LinearStepFunction15L135U80OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.15'), parseEther('1.35'), parseEther('0.85')),
    'LinearStepFunction15L135U85OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.15'), parseEther('1.35'), parseEther('0.90')),
    'LinearStepFunction15L135U90OInterestSetter',
  );

  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.16'), parseEther('0.84'), parseEther('0.60')),
    'LinearStepFunction16L84U60OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.16'), parseEther('0.84'), parseEther('0.70')),
    'LinearStepFunction16L84U70OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.16'), parseEther('0.84'), parseEther('0.80')),
    'LinearStepFunction16L84U80OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.16'), parseEther('0.84'), parseEther('0.90')),
    'LinearStepFunction16L84U90OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.16'), parseEther('0.84'), parseEther('0.95')),
    'LinearStepFunction16L84U95OInterestSetter',
  );

  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.20'), parseEther('1.05'), parseEther('0.70')),
    'LinearStepFunction20L105U70OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.20'), parseEther('1.30'), parseEther('0.70')),
    'LinearStepFunction20L130U70OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.30'), parseEther('0.95'), parseEther('0.70')),
    'LinearStepFunction30L95U70OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.30'), parseEther('1.20'), parseEther('0.70')),
    'LinearStepFunction30L120U70OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.40'), parseEther('0.85'), parseEther('0.70')),
    'LinearStepFunction40L85U70OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.40'), parseEther('1.10'), parseEther('0.70')),
    'LinearStepFunction40L110U70OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.50'), parseEther('0.75'), parseEther('0.70')),
    'LinearStepFunction50L75U70OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.50'), parseEther('1.00'), parseEther('0.70')),
    'LinearStepFunction50L100U70OInterestSetter',
  );
}
