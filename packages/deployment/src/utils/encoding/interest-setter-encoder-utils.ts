import { parseEther } from 'ethers/lib/utils';
import { IERC20 } from '../../../../base/src/types';
import {
  LowerPercentage,
  OptimalUtilizationRate,
  UpperPercentage,
} from '../../../../base/src/utils/constructors/dolomite';
import { CoreProtocolEthereum } from '../../../../base/test/utils/core-protocols/core-protocol-ethereum';
import { prettyPrintEncodedDataWithTypeSafety } from './base-encoder-utils';

export async function encodeModularInterestSetterParams(
  core: CoreProtocolEthereum,
  token: IERC20,
  lower: LowerPercentage,
  upper: UpperPercentage,
  optimalUtilizationRate: OptimalUtilizationRate,
) {
  return prettyPrintEncodedDataWithTypeSafety(
    core,
    core.interestSetters,
    'modularLinearInterestSetter',
    'ownerSetSettingsByToken',
    [token.address, parseEther(lower), parseEther(upper), parseEther(optimalUtilizationRate)],
  );
}
