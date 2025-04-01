import CoreDeployments from '@dolomite-exchange/dolomite-margin/dist/migrations/deployed.json';
import ModuleDeployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import { time, mine } from '@nomicfoundation/hardhat-network-helpers';
import { BigNumber, BigNumberish, ContractTransaction } from 'ethers';
import { config as hardhatConfig, ethers, network as hardhatNetwork, tracer } from 'hardhat';
import { HttpNetworkConfig } from 'hardhat/src/types/config';
import { Network, NETWORK_TO_NETWORK_NAME_MAP, ONE_ETH_BI } from '../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../src/utils/SignerWithAddressWithSafety';

const gasLogger: Record<string, BigNumber> = {};
const gasLoggerNumberOfCalls: Record<string, number> = {};

export async function increaseToTimestamp(timestamp: number): Promise<void> {
  await time.increaseTo(timestamp);
}

export async function increaseByTimeDelta(delta: number): Promise<void> {
  await time.increase(delta);
}

export async function advanceToTimestamp(timestamp: number): Promise<void> {
  await time.increaseTo(timestamp);
}

export async function advanceByTimeDelta(delta: number): Promise<void> {
  await time.increase(delta);
}

/**
 * Gets the most recent block number from the real network, NOT the forked network.
 * @param include32BlockBuffer Hardhat works better when there's > 31 block confirmations
 * @param network The network to get the latest block number from
 * @param networkName The name of the network, as it appears in the hardhat config file
 */
export async function getRealLatestBlockNumber(
  include32BlockBuffer: boolean,
  network: Network,
  networkName: string = NETWORK_TO_NETWORK_NAME_MAP[network],
): Promise<number> {
  const networkConfig = hardhatConfig?.networks?.[networkName] as HttpNetworkConfig;
  const provider = new ethers.providers.JsonRpcProvider(networkConfig.url);
  const blockNumber = await provider.send('eth_blockNumber', []);
  return Number.parseInt(blockNumber, 16) - (include32BlockBuffer ? 32 : 0);
}

export async function resetForkIfPossible(
  blockNumber: number,
  network: Network,
  networkName: string = NETWORK_TO_NETWORK_NAME_MAP[network],
) {
  if (hardhatNetwork.name !== 'hardhat') {
    console.log('\tSkipping forking...\n');
    return;
  }

  const networkConfig = hardhatConfig.networks?.[networkName] as HttpNetworkConfig;
  await hardhatNetwork.provider.request({
    method: 'hardhat_reset',
    params: [
      {
        forking: {
          blockNumber,
          jsonRpcUrl: networkConfig.url,
        },
      },
    ],
  });

  await mine();

  Object.keys(CoreDeployments).forEach(contractName => {
    const contractAddress = (CoreDeployments as any)[contractName]?.[network]?.address;
    if (contractAddress && tracer) {
      tracer.nameTags[contractAddress] = contractName;
    }
  });
  Object.keys(ModuleDeployments).forEach(contractName => {
    const contractAddress = (ModuleDeployments as any)[contractName]?.[network]?.address;
    if (contractAddress && tracer) {
      tracer.nameTags[contractAddress] = contractName;
    }
  });

}

/**
 * Note, snapshots can only be used once. Meaning, a new snapshot must be taken right after a reversion to ensure
 * a reversion can occur again in the future.
 *
 * @return The new snapshot ID of the chain
 */
export async function snapshot(): Promise<string> {
  const result = await hardhatNetwork.provider.request({
    method: 'evm_snapshot',
    params: [],
  });
  return result as string;
}

export async function getLatestBlockNumber(): Promise<number> {
  const block = await hardhatNetwork.provider.request({
    method: 'eth_getBlockByNumber',
    params: ['latest', false],
  });
  return Number.parseInt((block as any).number, 16);
}

export async function getBlockTimestamp(blockNumber: number): Promise<number> {
  const block = await hardhatNetwork.provider.request({
    method: 'eth_getBlockByNumber',
    params: [`0x${blockNumber.toString(16)}`, false],
  });
  return Number.parseInt((block as any).timestamp, 16);
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
    await hardhatNetwork.provider.request({
      method: 'evm_revert',
      params: [snapshotId],
    });
    return snapshot();
  }

  return id;
}

export async function setEtherBalance(address: string, balance: BigNumberish = '1000000000000000000') {
  await hardhatNetwork.provider.send('hardhat_setBalance', [
    address,
    `0x${ethers.BigNumber.from(balance).toBigInt().toString(16)}`,
  ]);
}

export async function impersonateOrFallback(
  targetAccount: string,
  giveEther: boolean,
  fallbackSigner: SignerWithAddressWithSafety,
): Promise<SignerWithAddressWithSafety> {
  if (hardhatNetwork.name !== 'hardhat') {
    return fallbackSigner;
  }
  return impersonate(targetAccount, giveEther);
}

export async function impersonate(
  targetAccount: string | { address: string },
  giveEther: boolean = false,
  balance = ONE_ETH_BI,
): Promise<SignerWithAddressWithSafety> {
  const targetAddress = typeof targetAccount === 'string' ? targetAccount : targetAccount.address;
  await hardhatNetwork.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [targetAddress],
  });
  if (giveEther) {
    await setEtherBalance(targetAddress, balance);
  }
  return SignerWithAddressWithSafety.create(targetAddress);
}

export async function impersonateAll(
  targetAccounts: string[],
  giveEther: boolean = false,
): Promise<SignerWithAddressWithSafety[]> {
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
  await hardhatNetwork.provider.request({
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

export function encodeExternalSellActionDataWithNoData(
  minAmountOut: BigNumberish,
): string {
  return encodeExternalSellActionData(minAmountOut, [], []);
}

export function encodeExternalSellActionData(
  minAmountOut: BigNumberish,
  innerTypes: string[],
  innerValues: any[],
): string {
  if (innerTypes.length !== innerValues.length) {
    throw new Error('Inner types and values must be the same length');
  } else if (innerTypes.length === 0) {
    return ethers.utils.defaultAbiCoder.encode(['uint256', 'bytes'], [minAmountOut, []]);
  }
  return ethers.utils.defaultAbiCoder.encode(
    ['uint256', 'bytes'],
    [
      minAmountOut,
      ethers.utils.defaultAbiCoder.encode(innerTypes, innerValues),
    ],
  );
}
