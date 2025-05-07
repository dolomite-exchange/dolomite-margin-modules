import { ActionType, AmountDenomination, AmountReference, ExpiryCallFunctionType } from '@dolomite-margin/dist/src';
import { BigNumberish, Contract, ContractTransaction } from 'ethers';
import { ethers } from 'hardhat';
import { DolomiteNetwork } from 'packages/base/src/utils/no-deps-constants';
import { ActionArgsStruct } from '../../src/utils';
import { AccountStruct } from '../../src/utils/constants';
import { impersonate } from './index';
import { CoreProtocolType } from './setup';

const abiCoder = ethers.utils.defaultAbiCoder;

export async function createExpirationLibrary(): Promise<Contract> {
  const ExpirationLib = await ethers.getContractFactory('ExpirationLib');
  return await ExpirationLib.deploy();
}

export async function setExpiry<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  account: AccountStruct,
  owedMarketId: BigNumberish,
  timeDelta: number,
): Promise<ContractTransaction> {
  const action: ActionArgsStruct = {
    actionType: ActionType.Call,
    accountId: 0,
    amount: { sign: false, ref: AmountReference.Delta, denomination: AmountDenomination.Actual, value: 0 },
    primaryMarketId: owedMarketId.toString(),
    secondaryMarketId: 0,
    otherAddress: core.expiry.address,
    otherAccountId: 0,
    data: abiCoder.encode(
      ['uint256', '((address, uint256), uint256, uint32, bool)[]'],
      [
        ExpiryCallFunctionType.SetExpiry,
        [[[account.owner, account.number], owedMarketId, timeDelta, true]],
      ],
    ),
  };
  const signer = await impersonate(account.owner, true);
  return core.dolomiteMargin.connect(signer).operate([account], [action]);
}
