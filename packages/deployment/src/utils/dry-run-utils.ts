import {
  networkToNetworkNameMap,
  NetworkType,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { advanceByTimeDelta, impersonate } from '@dolomite-exchange/modules-base/test/utils';
import { CoreProtocolType } from '@dolomite-exchange/modules-base/test/utils/setup';
import hardhat from 'hardhat';
import { createFolder, DenJsonUpload, readDeploymentFile, writeDeploymentFile, writeFile } from './deploy-utils';

const CHUNK_SIZE = 16;
const HARDHAT_CHAIN_ID = '31337';

export interface DryRunOutput<T extends NetworkType> {
  readonly upload: DenJsonUpload;
  readonly core: CoreProtocolType<T>;
  readonly scriptName: string;
  readonly invariants?: () => Promise<void>;
}

function chunkify<T>(array: T[], chunkSize: number): T[][] {
  const result = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    result.push(array.slice(i, i + chunkSize));
  }
  return result;
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

    console.log('\tSimulating admin transactions...');
    const signer = await impersonate((await result.core.delayedMultiSig.getOwners())[0], true);
    const delayedMultiSig = result.core.delayedMultiSig.connect(signer);
    const filter = delayedMultiSig.filters.Submission();
    const transactionIds = [];
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

      transactionIds.push((await delayedMultiSig.queryFilter(filter, txResult.blockHash))[0].args.transactionId);
    }

    console.log('\tSubmitted transactions. Advancing time forward...');
    await advanceByTimeDelta((await delayedMultiSig.secondsTimeLocked()) + 1);

    console.log('\tExecuting chunked transactions...');
    const transactionIdChunks = chunkify(transactionIds, CHUNK_SIZE);
    for (const transactionIdChunk of transactionIdChunks) {
      await delayedMultiSig.executeMultipleTransactions(transactionIdChunk);
    }
    console.log('\tAdmin transactions succeeded!');

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
      console.error(new Error(e.stack));
      process.exit(1);
    });
}