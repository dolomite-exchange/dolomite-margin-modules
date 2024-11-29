import {
  NETWORK_TO_NETWORK_NAME_MAP,
  NetworkType,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { CoreProtocolType } from '@dolomite-exchange/modules-base/test/utils/setup';
import { BaseContract } from 'ethers';
import hardhat from 'hardhat';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { IDolomiteOwner__factory } from 'packages/base/src/types';
import { advanceByTimeDelta } from 'packages/base/test/utils';
import {
  createFolder,
  DenJsonUpload,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
  readDeploymentFile,
  TransactionBuilderUpload,
  writeDeploymentFile,
  writeFile,
} from './deploy-utils';

const HARDHAT_CHAIN_ID = '31337';

export interface DryRunOutput<T extends NetworkType> {
  readonly upload: DenJsonUpload | TransactionBuilderUpload;
  readonly core: CoreProtocolType<T>;
  readonly scriptName: string;
  readonly skipTimeDelay?: boolean;
  readonly invariants?: () => Promise<void>;
}

function cleanHardhatDeployment(): void {
  const file = readDeploymentFile();
  let dirty = false;
  Object.keys(file).forEach((contractName) => {
    if (file[contractName][HARDHAT_CHAIN_ID]) {
      delete file[contractName][HARDHAT_CHAIN_ID];
      dirty = true;
    }
  });

  if (dirty) {
    writeDeploymentFile(file);
  }
}

async function doStuffInternal<T extends NetworkType>(executionFn: () => Promise<DryRunOutput<T>>) {
  if (hardhat.network.name === 'hardhat') {
    const result = await executionFn();

    if (result.core && result.upload.transactions.length > 0) {
      console.log('\tSimulating admin transactions...');
      const ownerAddress = await result.core.dolomiteMargin.owner();
      const invalidOwnerError = `Invalid governance (not DolomiteOwner or DelayedMultisig), found: ${ownerAddress}`;

      let ownerContract: BaseContract;
      let filter;
      if (ownerAddress === result.core.ownerAdapter?.address) {
        ownerContract = result.core.ownerAdapter;
        filter = result.core.ownerAdapter.filters.TransactionSubmitted();
      } else if (ownerAddress === result.core.delayedMultiSig.address) {
        ownerContract = result.core.delayedMultiSig;
        filter = result.core.delayedMultiSig.filters.Submission();
      } else {
        throw new Error(invalidOwnerError);
      }

      const transactionIds = [];

      for (const transaction of result.upload.transactions) {
        const signer = result.core.gnosisSafe;
        let txResult;
        if (transaction.to === result.core.governance.address) {
          txResult = await signer.sendTransaction({
            to: transaction.to,
            data: transaction.data,
            from: signer.address,
          });
        } else {
          if (ownerAddress === result.core.ownerAdapter?.address) {
            txResult = await result.core.ownerAdapter
              .connect(signer)
              .submitTransaction(transaction.to, transaction.data);
          } else if (ownerAddress === result.core.delayedMultiSig.address) {
            txResult = await result.core.delayedMultiSig
              .connect(signer)
              .submitTransaction(transaction.to, ZERO_BI, transaction.data);
          } else {
            throw new Error(invalidOwnerError);
          }
        }

        const submissionEvent = (await ownerContract.queryFilter(filter, txResult.blockHash))[0];
        if (submissionEvent) {
          transactionIds.push((submissionEvent.args as any).transactionId);
        }
      }

      let secondsTimeLocked: number;
      if (ownerAddress === result.core.ownerAdapter?.address) {
        secondsTimeLocked = await result.core.ownerAdapter.secondsTimeLocked();
      } else if (ownerAddress === result.core.delayedMultiSig.address) {
        secondsTimeLocked = await result.core.delayedMultiSig.secondsTimeLocked();
      } else {
        throw new Error(invalidOwnerError);
      }

      if (secondsTimeLocked > 0) {
        console.log(`\tAwaiting timelock duration: ${secondsTimeLocked}s`);
        await advanceByTimeDelta(secondsTimeLocked);
      }

      console.log('\tExecuting transactions...');
      for (const transactionId of transactionIds) {
        try {
          if (ownerAddress === result.core.ownerAdapter?.address) {
            await result.core.ownerAdapter.executeTransactions([transactionId], {});
          } else if (ownerAddress === result.core.delayedMultiSig.address) {
            await result.core.delayedMultiSig.executeTransaction(transactionId, {});
          } else {
            return Promise.reject(new Error(invalidOwnerError));
          }
        } catch (e: any) {
          const transactionIndex = transactionId.sub(transactionIds[0]).toNumber();
          throw new Error(
            `Execution of transaction with ID ${transactionId.toString()} failed due to error: ${e.message}\n
            transaction: ${JSON.stringify(result.upload.transactions[transactionIndex], undefined, 2)}`,
          );
        }
      }
      console.log('\tAdmin transactions succeeded!');
    }

    if (result.invariants) {
      console.log('\tChecking invariants...');
      await result.invariants();
      console.log('\tInvariants passed!');
    } else {
      console.log('\tNo invariants found, skipping...');
    }
  } else {
    const result = await executionFn();
    if (typeof result === 'undefined' || result.upload.transactions.length === 0) {
      return;
    }

    const ownerAddress = await result.core.dolomiteMargin.owner();
    const invalidOwnerAddress = `Invalid governance (not DolomiteOwner or DelayedMultisig), found: ${ownerAddress}`;

    let encodedTransactionForExecution: EncodedTransaction | null = null;
    if (result.upload.transactions.length > 0) {
      let transactionCount: number;
      if (ownerAddress === result.core.ownerAdapter?.address) {
        transactionCount = (await result.core.ownerAdapter.transactionCount()).toNumber();
      } else if (ownerAddress === result.core.delayedMultiSig.address) {
        transactionCount = (await result.core.delayedMultiSig.transactionCount()).toNumber();
      } else {
        return Promise.reject(new Error(invalidOwnerAddress));
      }

      const submitTransactionMethodId = '0xc6427474';
      const transactionIds: number[] = [];
      result.upload.transactions.forEach((t) => {
        if (t.data.startsWith(submitTransactionMethodId)) {
          transactionIds.push(transactionCount++);
        }
      });

      assertHardhatInvariant(transactionIds.length > 0, 'Transaction IDs length must be greater than 0');

      console.log('============================================================');
      console.log('================ Real Transaction Execution ================');
      console.log('============================================================');

      if (ownerAddress === result.core.ownerAdapter?.address) {
        encodedTransactionForExecution = await prettyPrintEncodedDataWithTypeSafety(
          result.core,
          { ownerAdapter: result.core.ownerAdapter },
          'ownerAdapter',
          'executeTransactions',
          [transactionIds],
          { skipWrappingCalldataInSubmitTransaction: true },
        );
      } else if (ownerAddress === result.core.delayedMultiSig.address) {
        encodedTransactionForExecution = await prettyPrintEncodedDataWithTypeSafety(
          result.core,
          { delayedMultiSig: result.core.delayedMultiSig },
          'delayedMultiSig',
          'executeMultipleTransactions',
          [transactionIds],
          { skipWrappingCalldataInSubmitTransaction: true },
        );
      } else {
        return Promise.reject(new Error(invalidOwnerAddress));
      }
    }

    const scriptName = result.scriptName;
    const networkName = NETWORK_TO_NETWORK_NAME_MAP[result.upload.chainId];
    const dir = `${__dirname}/../deploy/safe-transactions/${networkName}/output`;
    createFolder(dir);
    writeFile(`${dir}/${scriptName}.json`, JSON.stringify(result.upload, null, 2));

    if (encodedTransactionForExecution) {
      writeFile(
        `${dir}/${scriptName}-t.json`,
        JSON.stringify({ ...result.upload, transactions: [encodedTransactionForExecution] }, null, 2),
      );
    }
  }
}

export async function doDryRunAndCheckDeployment<T extends NetworkType>(
  executionFn: () => Promise<DryRunOutput<T>>,
): Promise<void> {
  await doStuffInternal(executionFn)
    .then(() => {
      cleanHardhatDeployment();
      process.exit(0);
    })
    .catch((e) => {
      cleanHardhatDeployment();
      console.error(new Error(e.stack));
      process.exit(1);
    });
}
