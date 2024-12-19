import {
  NETWORK_TO_NETWORK_NAME_MAP,
  NetworkType,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { CoreProtocolType } from '@dolomite-exchange/modules-base/test/utils/setup';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { Overrides } from '@ethersproject/contracts/src.ts';
import { BaseContract } from 'ethers';
import hardhat from 'hardhat';
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

      let ownerContract: BaseContract | undefined;
      let filter;
      if (ownerAddress === result.core.ownerAdapterV1.address) {
        ownerContract = result.core.ownerAdapterV1;
        filter = result.core.ownerAdapterV1.filters.TransactionSubmitted();
      } else if (ownerAddress === result.core.ownerAdapterV2.address) {
        ownerContract = result.core.ownerAdapterV2;
        filter = result.core.ownerAdapterV2.filters.TransactionSubmitted();
      } else if (ownerAddress === result.core.delayedMultiSig.address) {
        ownerContract = result.core.delayedMultiSig;
        filter = result.core.delayedMultiSig.filters.Submission();
      } else if (ownerAddress === result.core.gnosisSafe.address) {
        ownerContract = undefined;
        filter = undefined;
      } else {
        throw new Error(invalidOwnerError);
      }

      const transactionIds = [];

      for (const transaction of result.upload.transactions) {
        const signer = result.core.gnosisSafe;
        const gasLimit = 50_000_000;
        const overrides: Overrides = {
          gasLimit,
        };
        let txResult: TransactionResponse;
        if (transaction.to === result.core.governance.address) {
          txResult = await signer.sendTransaction({
            gasLimit,
            to: transaction.to,
            data: transaction.data,
          });
        } else {
          if (ownerAddress === result.core.ownerAdapterV1.address) {
            txResult = await result.core.ownerAdapterV1
              .connect(signer)
              .submitTransaction(transaction.to, transaction.data, overrides);
          } else if (ownerAddress === result.core.ownerAdapterV2.address) {
            txResult = await result.core.ownerAdapterV2
              .connect(signer)
              .submitTransaction(transaction.to, transaction.data, overrides);
          } else if (ownerAddress === result.core.delayedMultiSig.address) {
            txResult = await result.core.delayedMultiSig
              .connect(signer)
              .submitTransaction(transaction.to, ZERO_BI, transaction.data, overrides);
          } else if (ownerAddress === result.core.gnosisSafe.address) {
            txResult = await signer.sendTransaction({
              gasLimit,
              to: transaction.to,
              data: transaction.data,
            });
          } else {
            throw new Error(invalidOwnerError);
          }
        }

        const submissionEvent =
          ownerContract && filter ? (await ownerContract.queryFilter(filter, txResult.blockHash))[0] : undefined;
        if (submissionEvent) {
          transactionIds.push((submissionEvent.args as any).transactionId);
        }
      }

      let secondsTimeLocked: number;
      if (ownerAddress === result.core.ownerAdapterV1.address) {
        secondsTimeLocked = await result.core.ownerAdapterV1.secondsTimeLocked();
      } else if (ownerAddress === result.core.ownerAdapterV2.address) {
        secondsTimeLocked = await result.core.ownerAdapterV2.secondsTimeLocked();
      } else if (ownerAddress === result.core.delayedMultiSig.address) {
        secondsTimeLocked = await result.core.delayedMultiSig.secondsTimeLocked();
      } else if (ownerAddress === result.core.gnosisSafe.address) {
        secondsTimeLocked = 0;
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
          if (ownerAddress === result.core.ownerAdapterV1.address) {
            await result.core.ownerAdapterV1.executeTransactions([transactionId], {});
          } else if (ownerAddress === result.core.ownerAdapterV2.address) {
            await result.core.ownerAdapterV2.executeTransactions([transactionId], {});
          } else if (ownerAddress === result.core.delayedMultiSig.address) {
            await result.core.delayedMultiSig.executeTransaction(transactionId, {});
          } else if (ownerAddress === result.core.gnosisSafe.address) {
            console.log('\tSkipping execution for Gnosis Safe owner');
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
      if (ownerAddress === result.core.ownerAdapterV1.address) {
        transactionCount = (await result.core.ownerAdapterV1.transactionCount()).toNumber();
      } else if (ownerAddress === result.core.ownerAdapterV2.address) {
        transactionCount = (await result.core.ownerAdapterV2.transactionCount()).toNumber();
      } else if (ownerAddress === result.core.delayedMultiSig.address) {
        transactionCount = (await result.core.delayedMultiSig.transactionCount()).toNumber();
      } else if (ownerAddress === result.core.gnosisSafeAddress) {
        transactionCount = 0;
      } else {
        return Promise.reject(new Error(invalidOwnerAddress));
      }

      const submitTransactionMethodIds = ['0xc6427474', '0xbbf1b2f1'];
      const transactionIds: number[] = [];
      result.upload.transactions.forEach((t) => {
        if (submitTransactionMethodIds.some(methodId => t.data.startsWith(methodId))) {
          transactionIds.push(transactionCount++);
        }
      });

      if (transactionIds.length === 0) {
        console.warn('\tTransaction IDs length is equal to 0');
      }

      console.log('============================================================');
      console.log('================ Real Transaction Execution ================');
      console.log('============================================================');

      if (ownerAddress === result.core.ownerAdapterV1.address) {
        encodedTransactionForExecution = await prettyPrintEncodedDataWithTypeSafety(
          result.core,
          { ownerAdapter: result.core.ownerAdapterV1 },
          'ownerAdapter',
          'executeTransactions',
          [transactionIds],
          { skipWrappingCalldataInSubmitTransaction: true },
        );
      } else if (ownerAddress === result.core.ownerAdapterV2.address) {
        encodedTransactionForExecution = await prettyPrintEncodedDataWithTypeSafety(
          result.core,
          { ownerAdapter: result.core.ownerAdapterV2 },
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
      } else if (ownerAddress === result.core.gnosisSafeAddress) {
        console.log('\tExecute the transactions directly against the Gnosis Safe');
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
      console.error(e.stack);
      process.exit(1);
    });
}
