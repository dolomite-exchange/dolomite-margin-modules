import { BaseContract } from 'ethers';
import { createContract } from '../../../src/utils/dolomite-utils';

export async function createSafeDelegateLibrary(): Promise<BaseContract> {
  return createContract('SafeDelegateCallLib', []);
}
