import {
  networkToNetworkNameMap,
  NetworkType,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { advanceByTimeDelta, impersonate } from '@dolomite-exchange/modules-base/test/utils';
import { CoreProtocolType } from '@dolomite-exchange/modules-base/test/utils/setup';
import hardhat from 'hardhat';
import {
  createFolder,
  DenJsonUpload,
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
  Object.keys(file).forEach(contractName => {
    if (file[contractName][HARDHAT_CHAIN_ID]) {
      delete file[contractName][HARDHAT_CHAIN_ID];
      dirty = true;
    }
  });

  if (dirty) {
    writeDeploymentFile(file);
  }
}

async function doStuffInternal<T extends NetworkType>(
  executionFn: () => Promise<DryRunOutput<T>>,
) {
  if (hardhat.network.name === 'hardhat') {
    const result = await executionFn();

    if (result.core) {
      console.log('\tSimulating admin transactions...');
      const signer = await impersonate((await result.core.delayedMultiSig.getOwners())[0], true);
      const delayedMultiSig = result.core.delayedMultiSig.connect(signer);
      const filter = delayedMultiSig.filters.Submission();
      const transactionIds = [];
      const timeDelay = result.skipTimeDelay ? 0 : await delayedMultiSig.secondsTimeLocked();

      if (result.skipTimeDelay) {
        console.log('\tSkipping time delay...');
        const impersonator = await impersonate(delayedMultiSig.address, true);
        await delayedMultiSig.connect(impersonator).changeTimeLock(0);
      }

      for (const transaction of result.upload.transactions) {
        let txResult;
        if (transaction.to === result.core.delayedMultiSig.address) {
          txResult = await signer.sendTransaction({
            to: transaction.to,
            data: transaction.data,
            from: signer.address,
          });
        } else {
          txResult = await delayedMultiSig.submitTransaction(transaction.to, ZERO_BI, transaction.data);
        }

        const submissionEvent = (await delayedMultiSig.queryFilter(filter, txResult.blockHash))[0];
        if (submissionEvent) {
          transactionIds.push(submissionEvent.args.transactionId);
        }
      }

      console.log('\tSubmitted transactions. Advancing time forward...');
      await advanceByTimeDelta(timeDelay + 1);

      console.log('\tExecuting transactions...');
      for (const transactionId of transactionIds) {
        try {
          await delayedMultiSig.executeMultipleTransactions([transactionId]);
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
    return executionFn().then(result => {
      if (typeof result === 'undefined') {
        return;
      }

      const scriptName = result.scriptName;
      const networkName = networkToNetworkNameMap[result.upload.chainId];
      const dir = `${__dirname}/../deploy/safe-transactions/${networkName}/output`;
      createFolder(dir);
      writeFile(`${dir}/${scriptName}.json`, JSON.stringify(result.upload, null, 2));
    });
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
    .catch(e => {
      cleanHardhatDeployment();
      console.error(new Error(e.stack));
      process.exit(1);
    });
}
