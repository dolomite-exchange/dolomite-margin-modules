import { CoreProtocolType } from '@dolomite-exchange/modules-base/test/utils/setup';
import { NetworkType } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { BigNumberish } from 'ethers';
import { getOwnerContractAndSubmissionFilter } from './dry-run-utils';

interface TransactionData {
  type: 'TRANSACTION';
  transaction: {
    txStatus: 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'AWAITING_CONFIRMATIONS' | 'AWAITING_EXECUTION';
    executionInfo: null | {
      type: 'MULTISIG';
      nonce: number;
      confirmationsRequired: number;
      confirmationsSubmitted: number;
      missingSigners: string[] | null;
    };
    txHash: string | null; // Transaction hash
  };
  conflictType: 'None';
}

export async function getTransactionIdsBySafeNonce<T extends NetworkType>(
  core: CoreProtocolType<T>,
  nonce: number,
): Promise<BigNumberish[]> {
  const network = core.network;
  const safeAddress = core.gnosisSafeAddress;
  let url = `https://safe-client.safe.global/v1/chains/${network}/safes/${safeAddress}/transactions/history`;
  let transactionData: TransactionData | undefined;
  while (url && !transactionData) {
    const json = await fetch(url).then(r => r.json());
    transactionData = json['results'].find((value: any): value is TransactionData => {
      return isTransactionType(value) && value.transaction.executionInfo?.nonce === nonce;
    });

    url = json['next'];
  }

  if (!transactionData) {
    return Promise.reject(new Error(`Could not find transaction for nonce: ${nonce}`));
  }

  const ownerAddress = await core.dolomiteMargin.owner();
  const { ownerContract, filter } = getOwnerContractAndSubmissionFilter(core, ownerAddress);
  if (!ownerContract || !filter) {
    return Promise.reject(new Error('Invalid owner address; cannot find filter'));
  }

  const receipt = await core.hhUser1.provider!.getTransactionReceipt(transactionData.transaction.txHash!);
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
