import {
  DolomiteNetwork,
  NETWORK_TO_MULTI_SEND_MAP,
  NETWORK_TO_NETWORK_NAME_MAP,
  NETWORK_TO_SAFE_HASH_NAME_MAP,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { CoreProtocolType } from '@dolomite-exchange/modules-base/test/utils/setup';
import { TxResult } from '@dolomite-margin/dist/src';
import { FunctionFragment } from '@ethersproject/abi';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { Overrides } from '@ethersproject/contracts/src.ts';
import { execSync } from 'child_process';
import { BaseContract, BigNumber, BigNumberish, ethers, type EventFilter } from 'ethers';
import hardhat from 'hardhat';
import { advanceByTimeDelta } from 'packages/base/test/utils';
import { GNOSIS_SAFE_MAP } from '../../../base/src/utils/constants';
import {
  createFolder,
  readDeploymentFile,
  TRANSACTION_BUILDER_VERSION,
  writeDeploymentFile,
  writeFile,
} from './deploy-utils';
import { prettyPrintEncodedDataWithTypeSafety } from './encoding/base-encoder-utils';
import GnosisSafeAbi from './GnosisSafe.json';
import MultiSendAbi from './MultiSend.json';
import { checkPerformance } from './performance-utils';

const HARDHAT_CHAIN_ID = '31337';
const SUBMIT_TRANSACTION_METHOD_IDS = ['0xc6427474', '0xbbf1b2f1'];
// These functions invoke the DolomiteOwner and therefore tick the `transactionId` field
const ADMIN_FUNCTION_METHOD_IDS = [
  '0x7aa25719', // PartnerClaimExcessTokensV1::claimExcessTokens
  '0x7aa25719', // AdminClaimExcessTokensV1::claimExcessTokens
  '0xfc12524c', // AdminPauseMarketV1::pauseMarket
  '0xb28678ce', // AdminPauseMarketV1::unpauseMarket
];

export interface EncodedTransaction {
  to: string;
  value: string;
  data: string;
}

export interface DenJsonUpload {
  addExecuteImmediatelyTransactions?: boolean;
  logGasUsage?: boolean;
  chainId: DolomiteNetwork;
  transactions: EncodedTransaction[];
}

export interface TransactionBuilderUpload extends DenJsonUpload {
  version: '1.0';
  meta: {
    name: string;
    txBuilderVersion: typeof TRANSACTION_BUILDER_VERSION;
  };
}

export interface DryRunOutput<T extends DolomiteNetwork> {
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

export function getOwnerContractAndSubmissionFilter<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  ownerAddress: string,
) {
  let ownerContract: BaseContract | undefined;
  let filter: EventFilter | undefined;
  if (ownerAddress === core.ownerAdapterV1.address) {
    ownerContract = core.ownerAdapterV1;
    filter = core.ownerAdapterV1.filters.TransactionSubmitted();
  } else if (ownerAddress === core.ownerAdapterV2.address) {
    ownerContract = core.ownerAdapterV2;
    filter = core.ownerAdapterV2.filters.TransactionSubmitted();
  } else if (ownerAddress === core.delayedMultiSig.address) {
    ownerContract = core.delayedMultiSig;
    filter = core.delayedMultiSig.filters.Submission();
  } else if (ownerAddress === core.gnosisSafeAddress) {
    ownerContract = undefined;
    filter = undefined;
  } else {
    throw new Error(getInvalidOwnerError(ownerAddress));
  }

  return { ownerContract, filter };
}

function getInvalidOwnerError(ownerAddress: string): string {
  return `Invalid governance (not DolomiteOwner or DelayedMultisig), found: ${ownerAddress}`;
}

async function doStuffInternal<T extends DolomiteNetwork>(executionFn: () => Promise<DryRunOutput<T>>) {
  if (hardhat.network.name === 'hardhat') {
    const result = await executionFn();

    if (result.core && result.upload.transactions.length > 0) {
      console.log('\tSimulating admin transactions...');

      const ownerAddress = await result.core.dolomiteMargin.owner();
      const invalidOwnerError = getInvalidOwnerError(ownerAddress);
      const transactionIds = await getTransactionIds(ownerAddress, result);

      for (const transaction of result.upload.transactions) {
        const signer = result.core.gnosisSafe;
        const gasLimit = 50_000_000;
        const overrides: Overrides = {
          gasLimit,
        };
        let txResult: TransactionResponse;
        if (transaction.to === result.core.governance.address || transaction.to !== ownerAddress) {
          txResult = await executeTransactionAndTraceOnFailure(result.core, () =>
            signer.sendTransaction({
              gasLimit,
              to: transaction.to,
              data: transaction.data,
            }),
          );
        } else {
          if (ownerAddress === result.core.ownerAdapterV1.address) {
            txResult = await executeTransactionAndTraceOnFailure(result.core, () =>
              result.core.ownerAdapterV1.connect(signer).submitTransaction(transaction.to, transaction.data, overrides),
            );
          } else if (ownerAddress === result.core.ownerAdapterV2.address) {
            txResult = await executeTransactionAndTraceOnFailure(result.core, () =>
              result.core.ownerAdapterV2.connect(signer).submitTransaction(transaction.to, transaction.data, overrides),
            );
          } else if (ownerAddress === result.core.delayedMultiSig.address) {
            txResult = await executeTransactionAndTraceOnFailure(result.core, () =>
              result.core.delayedMultiSig
                .connect(signer)
                .submitTransaction(transaction.to, ZERO_BI, transaction.data, overrides),
            );
          } else if (ownerAddress === result.core.gnosisSafe.address) {
            txResult = await executeTransactionAndTraceOnFailure(result.core, () =>
              signer.sendTransaction({
                gasLimit,
                to: transaction.to,
                data: transaction.data,
              }),
            );
          } else {
            throw new Error(invalidOwnerError);
          }
        }

        if (result.upload.logGasUsage) {
          const index = result.upload.transactions.indexOf(transaction);
          const receipt = await txResult.wait();
          console.log(`\tGas usage for submission [${index}]: ${receipt.gasUsed.toNumber().toLocaleString()}`);
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
      await executeAdminFunctions(transactionIds);

      async function executeAdminFunctions(transactionIds: BigNumberish[]) {
        for (const transactionId of transactionIds) {
          try {
            let txResult: TransactionResponse | undefined;
            if (ownerAddress === result.core.ownerAdapterV1.address) {
              txResult = await executeTransactionAndTraceOnFailure(result.core, () =>
                result.core.ownerAdapterV1.executeTransactions([transactionId], {}),
              );
            } else if (ownerAddress === result.core.ownerAdapterV2.address) {
              txResult = await executeTransactionAndTraceOnFailure(result.core, () =>
                result.core.ownerAdapterV2.executeTransactions([transactionId], {}),
              );
            } else if (ownerAddress === result.core.delayedMultiSig.address) {
              txResult = await executeTransactionAndTraceOnFailure(result.core, () =>
                result.core.delayedMultiSig.executeTransaction(transactionId, {}),
              );
            } else if (ownerAddress === result.core.gnosisSafe.address) {
              console.log('\tSkipping execution for Gnosis Safe owner');
            } else {
              return Promise.reject(new Error(invalidOwnerError));
            }

            if (result.upload.logGasUsage && txResult) {
              const receipt = await txResult.wait();
              const gasUsed = receipt.gasUsed.toNumber().toLocaleString();
              console.log(`\tGas usage for execution[${transactionId}]: ${gasUsed}`);
            }
          } catch (e: any) {
            const transactionIndex = BigNumber.from(transactionId).sub(transactionIds[0]).toNumber();
            throw new Error(
              `Execution of transaction with ID ${transactionId.toString()} failed due to error: ${e.message}\n
            transaction: ${JSON.stringify(result.upload.transactions[transactionIndex], undefined, 2)}`,
            );
          }
        }
      }

      console.log('\tAdmin transactions succeeded!');
    }

    if (result.invariants) {
      console.log('\tChecking invariants...');
      await checkPerformance('invariants', result.invariants);
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
    const invalidOwnerError = getInvalidOwnerError(ownerAddress);
    const transactionIds = await getTransactionIds(ownerAddress, result);

    let encodedTransactionForExecution: EncodedTransaction | null = null;
    if (result.upload.transactions.length > 0) {

      if (transactionIds.length === 0) {
        console.warn('\tTransaction IDs length is equal to 0');
      } else {
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
          return Promise.reject(new Error(invalidOwnerError));
        }
      }
    }

    const scriptName = result.scriptName;
    const multiSendContract = NETWORK_TO_MULTI_SEND_MAP[result.upload.chainId];
    const gnosisSafeContract = new BaseContract(
      GNOSIS_SAFE_MAP[result.upload.chainId],
      GnosisSafeAbi,
      result.core.hhUser1,
    );
    const nonce = ((await gnosisSafeContract.functions.nonce()) as BigNumber[])[0].toNumber();

    const packedTransactions = ethers.utils.solidityPack(
      result.upload.transactions.reduce(
        (acc, _) => acc.concat(...['uint8', 'address', 'uint256', 'uint256', 'bytes']),
        [] as string[],
      ),
      result.upload.transactions.reduce(
        (acc, t) => acc.concat(...['0', t.to, t.value, ((t.data.length - 2) / 2).toString(), t.data]),
        [] as string[],
      ),
    );
    const fragment = FunctionFragment.from('multiSend(bytes)');
    const multiSendCalldata = new ethers.utils.Interface(MultiSendAbi).encodeFunctionData(fragment, [
      packedTransactions,
    ]);
    const gnosisSafeAddress = result.core.gnosisSafeAddress;
    console.log('\tGenerating safe hash for transaction submission...');
    const networkNameForSafeHashOpt = NETWORK_TO_SAFE_HASH_NAME_MAP[result.upload.chainId];
    if (!networkNameForSafeHashOpt) {
      console.log();
      console.warn('\tSafe Hash is not supported on this network. You can only validate the message hash...');
      console.log();
    }

    const networkNameForSafeHash = networkNameForSafeHashOpt ?? 'arbitrum';

    if (result.upload.transactions.length > 1) {
      execSync(
        `safe_hashes --offline --network ${networkNameForSafeHash} --nonce ${nonce} --address ${gnosisSafeAddress} --to ${multiSendContract} --data ${multiSendCalldata} --operation 1`,
        { stdio: 'inherit' },
      );
    } else {
      const to = result.upload.transactions[0].to;
      const data = result.upload.transactions[0].data;
      execSync(
        `safe_hashes --offline --network ${networkNameForSafeHash} --nonce ${nonce} --address ${gnosisSafeAddress} --to ${to} --data ${data}`,
        { stdio: 'inherit' },
      );
    }

    if (encodedTransactionForExecution) {
      console.log('');
      console.log('');
      console.log('\tGenerating safe hash for transaction submission...');
      const encodedTo = encodedTransactionForExecution.to;
      const encodedCalldata = encodedTransactionForExecution.data;
      const nextNonce = nonce + 1;

      execSync(
        `safe_hashes --offline --network ${networkNameForSafeHash} --nonce ${nextNonce} --address ${gnosisSafeAddress} --to ${encodedTo} --data ${encodedCalldata}`,
        { stdio: 'inherit' },
      );
    }

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

async function getTransactionIds<T extends DolomiteNetwork>(
  ownerAddress: string,
  result: DryRunOutput<T>,
): Promise<BigNumberish[]> {
  const invalidOwnerAddress = `Invalid governance (not DolomiteOwner or DelayedMultisig), found: ${ownerAddress}`;

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

  const transactionIds: number[] = [];
  for (const transaction of result.upload.transactions) {
    if (SUBMIT_TRANSACTION_METHOD_IDS.some((methodId) => transaction.data.startsWith(methodId))) {
      transactionIds.push(transactionCount++);
    } else if (ADMIN_FUNCTION_METHOD_IDS.some((methodId) => transaction.data.startsWith(methodId))) {
      console.log('\tSkipping transaction ID due to admin function call...');
      transactionCount++;
    }
  }

  return transactionIds;
}

async function executeTransactionAndTraceOnFailure<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  transactionExecutor: () => Promise<TransactionResponse>,
): Promise<TransactionResponse> {
  try {
    hardhat.tracer.enabled = true;
    hardhat.tracer.printNext = true;
    return await transactionExecutor();
  } catch (e: any) {
    return Promise.reject(e);
  }
}

export async function doDryRunAndCheckDeployment<T extends DolomiteNetwork>(
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
