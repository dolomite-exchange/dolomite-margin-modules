import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, BigNumberish, ContractTransaction } from 'ethers';
import { config as hardhatConfig, ethers, network } from 'hardhat';

const gasLogger: Record<string, BigNumber> = {};
const gasLoggerNumberOfCalls: Record<string, number> = {};

/**
 * Gets the most recent block number from the real network, NOT the forked network.
 * @param include32BlockBuffer Hardhat works better when there's > 31 block confirmations
 */
export async function getRealLatestBlockNumber(include32BlockBuffer: boolean): Promise<number> {
  const provider = new ethers.providers.JsonRpcProvider(hardhatConfig?.networks?.hardhat?.forking?.url);
  const blockNumber = await provider.send('eth_blockNumber', []);
  return Number.parseInt(blockNumber, 16) - (include32BlockBuffer ? 32 : 0);
}

export async function resetFork(blockNumber: number) {
  await network.provider.request({
    method: 'hardhat_reset',
    params: [
      {
        forking: {
          blockNumber,
          jsonRpcUrl: hardhatConfig.networks?.hardhat?.forking?.url,
        },
      },
    ],
  });
}

/**
 * Note, snapshots can only be used once. Meaning, a new snapshot must be taken right after a reversion to ensure
 * a reversion can occur again in the future.
 *
 * @return The new snapshot ID of the chain
 */
export async function snapshot(): Promise<string> {
  const result = await network.provider.request({
    method: 'evm_snapshot',
    params: [],
  });
  return result as string;
}

/**
 * Note, snapshots can only be used once. Meaning, a new snapshot must be taken right after a reversion to ensure
 * a reversion can occur again in the future.
 *
 * @param snapshotId The snapshot point at which the chain will be reverted.
 * @return The new snapshot that was taken right after the reversion or the previous ID if a reversion did not occur.
 */
export async function revertToSnapshotAndCapture(snapshotId: string): Promise<string> {
  const id = await snapshot();

  if (id !== snapshotId) {
    await network.provider.request({
      method: 'evm_revert',
      params: [snapshotId],
    });
    return snapshot();
  }

  return id;
}

export async function setEtherBalance(address: string, balance: BigNumberish = '1000000000000000000') {
  await network.provider.send('hardhat_setBalance', [
    address,
    `0x${ethers.BigNumber.from(balance).toBigInt().toString(16)}`,
  ]);
}

export async function impersonateOrFallback(
  targetAccount: string,
  giveEther: boolean,
  fallbackSigner: SignerWithAddress,
): Promise<SignerWithAddress> {
  if (network.name !== 'hardhat') {
    return fallbackSigner;
  }
  return impersonate(targetAccount, giveEther);
}

export async function impersonate(targetAccount: string, giveEther: boolean = false): Promise<SignerWithAddress> {
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [targetAccount],
  });
  if (giveEther) {
    await setEtherBalance(targetAccount);
  }
  return ethers.getSigner(targetAccount);
}

export async function impersonateAll(
  targetAccounts: string[],
  giveEther: boolean = false,
): Promise<SignerWithAddress[]> {
  const signers = [];
  for (let i = 0; i < targetAccounts.length; i++) {
    signers[i] = await impersonate(targetAccounts[i], giveEther);
  }
  return signers;
}

export async function gasLog(logTo: string, transactionPromise: Promise<ContractTransaction>) {
  const transaction = await transactionPromise;
  const gasUsed = (await ethers.provider.getTransactionReceipt(transaction.hash)).gasUsed;

  if (typeof gasLogger[logTo] === 'undefined') {
    gasLogger[logTo] = gasUsed;
    gasLoggerNumberOfCalls[logTo] = 1;
  } else {
    const numberOfCalls = ++gasLoggerNumberOfCalls[logTo];
    gasLogger[logTo] = gasLogger[logTo].div(numberOfCalls).add(gasUsed.div(numberOfCalls));
  }
}

export async function printGasLog() {
  console.log('\tGas used:', JSON.stringify(gasLogger, undefined, '\n'));
}

export async function advanceNBlock(n: number, secondsPerBlock: number = 1) {
  await ethers.provider.send('hardhat_mine', [`0x${n.toString(16)}`, `0x${secondsPerBlock.toString(16)}`]);
}

export async function waitTime(timeToAddSeconds: number) {
  const currentTimestamp = await ethers.provider.getBlock('latest');
  await ethers.provider.send('evm_setNextBlockTimestamp', [currentTimestamp.timestamp + timeToAddSeconds]);
  await ethers.provider.send('evm_mine', []);
}

export async function waitDays(n: number) {
  await waitTime((n * 86400) + 1);
}

export async function waitHours(n: number) {
  await waitTime(n * 3600 + 1);
}

export async function sendEther(from: string, to: string, value: BigNumberish): Promise<any> {
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [from],
  });

  const signer = await ethers.getSigner(from);
  return signer.sendTransaction({
    from,
    to,
    value,
  });
}
