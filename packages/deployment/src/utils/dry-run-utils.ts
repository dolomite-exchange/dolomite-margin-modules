import {
  networkToNetworkNameMap,
  NetworkType,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { CoreProtocolType } from '@dolomite-exchange/modules-base/test/utils/setup';
import hardhat from 'hardhat';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
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

    if (result.core) {
      console.log('\tSimulating admin transactions...');
      const filter = result.core.ownerAdapter.filters.TransactionSubmitted();
      const transactionIds = [];

      for (const transaction of result.upload.transactions) {
        let txResult;
        if (transaction.to === result.core.ownerAdapter.address) {
          txResult = await result.core.governance.sendTransaction({
            to: transaction.to,
            data: transaction.data,
            from: result.core.governance.address,
          });
        } else {
          txResult = await result.core.ownerAdapter.submitTransaction(transaction.to, ZERO_BI, transaction.data);
        }

        const submissionEvent = (await result.core.ownerAdapter.queryFilter(filter, txResult.blockHash))[0];
        if (submissionEvent) {
          transactionIds.push(submissionEvent.args.transactionId);
        }
      }

      console.log('\tExecuting transactions...');
      for (const transactionId of transactionIds) {
        try {
          await result.core.ownerAdapter.executeTransactions([transactionId], {});
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
    if (typeof result === 'undefined') {
      return;
    }

    let encodedTransactionForExecution: EncodedTransaction | null = null;
    if (result.upload.addExecuteImmediatelyTransactions && result.upload.transactions.length > 0) {
      let transactionCount = (await result.core.ownerAdapter.transactionCount()).toNumber();
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
      encodedTransactionForExecution = await prettyPrintEncodedDataWithTypeSafety(
        result.core,
        { ownerAdapter: result.core.ownerAdapter },
        'ownerAdapter',
        'executeTransactions',
        [transactionIds],
        { skipWrappingCalldataInSubmitTransaction: true },
      );
    }

    const scriptName = result.scriptName;
    const networkName = networkToNetworkNameMap[result.upload.chainId];
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
