import { BaseContract } from 'ethers';
import { createContractWithName } from '../../../src/utils/dolomite-utils';

export async function createSafeDelegateLibrary(): Promise<BaseContract> {
  return createContractWithName('SafeDelegateCallLib', []);
}
