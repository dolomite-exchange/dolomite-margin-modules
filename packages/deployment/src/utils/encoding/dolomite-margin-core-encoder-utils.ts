import { BigNumberish } from 'ethers';
import { NetworkType } from '../../../../base/src/utils/no-deps-constants';
import { CoreProtocolType } from '../../../../base/test/utils/setup';
import { EncodedTransaction } from '../dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from './base-encoder-utils';

export async function encodeSetGlobalOperator<T extends NetworkType>(
  core: CoreProtocolType<T>,
  address: string | { address: string },
  isGlobalOperator: boolean,
): Promise<EncodedTransaction> {
  return prettyPrintEncodedDataWithTypeSafety(
    core,
    { dolomite: core.dolomiteMargin },
    'dolomite',
    'ownerSetGlobalOperator',
    [typeof address === 'string' ? address : address.address, isGlobalOperator],
  );
}

export async function encodeSetSupplyCap<T extends NetworkType>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
  amount: BigNumberish,
): Promise<EncodedTransaction> {
  if ('ownerSetMaxWei' in core.dolomiteMargin) {
    return prettyPrintEncodedDataWithTypeSafety(core, { dolomite: core.dolomiteMargin }, 'dolomite', 'ownerSetMaxWei', [
      marketId,
      amount,
    ]);
  }

  return prettyPrintEncodedDataWithTypeSafety(
    core,
    { dolomite: core.dolomiteMargin },
    'dolomite',
    'ownerSetMaxSupplyWei',
    [marketId, amount],
  );
}

export async function encodeSetBorrowCap<T extends NetworkType>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
  amount: BigNumberish,
): Promise<EncodedTransaction> {
  if ('ownerSetMaxWei' in core.dolomiteMargin) {
    return Promise.reject(new Error('Invalid Dolomite version!'));
  }

  return prettyPrintEncodedDataWithTypeSafety(
    core,
    { dolomite: core.dolomiteMargin },
    'dolomite',
    'ownerSetMaxBorrowWei',
    [marketId, amount],
  );
}
