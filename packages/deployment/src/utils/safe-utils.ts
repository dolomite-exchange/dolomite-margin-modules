import { CoreProtocolType } from '@dolomite-exchange/modules-base/test/utils/setup';
import { NetworkType } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { BigNumberish } from 'ethers';
import { getOwnerContractAndSubmissionFilter } from './dry-run-utils';

interface TransactionData {
  type: 'TRANSACTION';
  transaction: {
    txInfo: {
      type: 'Custom';
      humanDescription: string | null;
      to: {
        value: string; // Address
        name: string | null;
        logoUri: string | null;
      };
      dataSize: string;
      value: string; // Transaction value
      methodName: string | null;
      actionCount: number | null;
      isCancellation: boolean;
    };
    id: string; // Unique transaction ID
    timestamp: number; // UNIX timestamp in milliseconds
    txStatus: 'SUCCESS' | 'PENDING' | 'FAILED'; // Transaction status
    executionInfo: {
      type: 'MULTISIG';
      nonce: number;
      confirmationsRequired: number;
      confirmationsSubmitted: number;
      missingSigners: string[] | null; // Addresses of missing signers, if any
    };
    safeAppInfo: null | {
      // Define structure if safeAppInfo is not null in other cases
    };
    txHash: string; // Transaction hash
  };
  conflictType: 'None' | string; // Additional conflict type statuses (if applicable)
}

export async function getTransactionIdsBySafeNonce<T extends NetworkType>(
  core: CoreProtocolType<T>,
  nonce: number,
): Promise<BigNumberish[] | undefined> {
  const safeAddress = core.gnosisSafeAddress;
  const url = `https://safe-client.safe.global/v1/chains/80094/safes/${safeAddress}/transactions/history`;
  const response = await fetch(url);
  const json = (await response.json())['results'] as any[];
  const transactionData = json.find((value: any): value is TransactionData => {
    return isTransactionType(value) && value.transaction.executionInfo.nonce === nonce;
  });
  if (!transactionData) {
    return undefined;
  }

  const ownerAddress = await core.dolomiteMargin.owner();
  const { ownerContract, filter } = getOwnerContractAndSubmissionFilter(core, ownerAddress);
  if (!ownerContract || !filter) {
    return Promise.reject(new Error('Invalid owner address; cannot find filter'));
  }

  const receipt = await core.hhUser1.provider!.getTransactionReceipt(transactionData.transaction.txHash);
  const logs = receipt.logs.filter(log => log.topics[0] === filter!.topics![0]);
  return logs.reduce((acc, log) => {
    const event = ownerContract.interface.parseLog(log);
    return acc.concat(event.args.transactionId);
  }, [] as BigNumberish[]);
}

function isTransactionType(data: any): data is TransactionData {
  if (!data.type) {
    return false;
  }
  return data.type === 'TRANSACTION';
}
