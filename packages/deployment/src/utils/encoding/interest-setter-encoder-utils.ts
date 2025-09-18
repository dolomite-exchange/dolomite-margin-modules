import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { CoreProtocolType } from 'packages/base/test/utils/setup';
import { IERC20 } from '../../../../base/src/types';
import {
  LowerPercentage,
  OptimalUtilizationRate,
  UpperPercentage,
} from '../../../../base/src/utils/constructors/dolomite';
import { DolomiteNetwork } from '../../../../base/src/utils/no-deps-constants';
import { EncodedTransaction } from '../dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from './base-encoder-utils';

export async function encodeModularInterestSetterParams<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  token: IERC20,
  lower: LowerPercentage,
  upper: UpperPercentage,
  optimalUtilizationRate: OptimalUtilizationRate,
): Promise<EncodedTransaction> {
  const lowerNumber = parseEther(lower);
  const upperNumber = parseEther(upper);
  assertHardhatInvariant(
    lowerNumber.lt(upperNumber) && lowerNumber.lt(upperNumber.sub(lowerNumber)),
    'Invalid lower and upper percentages!',
  );

  return prettyPrintEncodedDataWithTypeSafety(
    core,
    core.interestSetters,
    'modularInterestSetter',
    'ownerSetSettingsByToken',
    [token.address, lowerNumber, upperNumber.sub(lowerNumber), parseEther(optimalUtilizationRate)],
  );
}
