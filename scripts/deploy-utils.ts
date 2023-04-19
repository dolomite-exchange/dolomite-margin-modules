import { address } from '@dolomite-exchange/dolomite-margin';
import { sleep } from '@openzeppelin/upgrades';
import { BigNumberish, PopulatedTransaction } from 'ethers';
import fs from 'fs';
import { network, run } from 'hardhat';
import { createContract } from '../src/utils/dolomite-utils';

type ChainId = string;

export async function verifyContract(address: string, constructorArguments: any[]) {
  try {
    await run('verify:verify', {
      address,
      constructorArguments,
      network: 'arbitrumTestnet',
    });
  } catch (e: any) {
    if (e?.message.toLowerCase().includes('already verified')) {
      console.log('EtherscanVerification: Swallowing already verified error');
    } else {
      throw e;
    }
  }
}

type ConstructorArgument = string | BigNumberish | boolean | ConstructorArgument[];

export async function deployContractAndSave(
  chainId: number,
  contractName: string,
  args: ConstructorArgument[],
  contractRename?: string,
): Promise<address> {
  const fileBuffer = fs.readFileSync('./scripts/deployments.json');

  let file: Record<string, Record<ChainId, any>>;
  try {
    file = JSON.parse(fileBuffer.toString()) ?? {};
  } catch (e) {
    file = {};
  }

  const usedContractName = contractRename ?? contractName;
  if (file[usedContractName]?.[chainId.toString()]) {
    console.log(`Contract ${usedContractName} has already been deployed to chainId ${chainId}. Skipping...`);
    const contract = file[usedContractName][chainId.toString()];
    if (!contract.isVerified) {
      await prettyPrintAndVerifyContract(file, chainId, usedContractName, args);
    }
    return contract.address;
  }

  console.log(`Deploying ${usedContractName} to chainId ${chainId}...`);

  const contract = await createContract(contractName, args);

  file[usedContractName] = {
    ...file[usedContractName],
    [chainId]: {
      address: contract.address,
      transaction: contract.deployTransaction.hash,
      isVerified: false,
    },
  };

  if (network.name !== 'hardhat') {
    writeFile(file);
  }

  await prettyPrintAndVerifyContract(file, chainId, usedContractName, args);

  return contract.address;
}

async function prettyPrintAndVerifyContract(
  file: Record<string, Record<ChainId, any>>,
  chainId: number,
  contractName: string,
  args: any[],
) {
  const contract = file[contractName][chainId.toString()];

  console.log(`========================= ${contractName} =========================`);
  console.log('Address: ', contract.address);
  console.log('='.repeat(52 + contractName.length));

  if (network.name !== 'hardhat') {
    console.log('Sleeping for 5s to wait for the transaction to be indexed by Etherscan...');
    await sleep(5000);
    await verifyContract(contract.address, [...args]);
    file[contractName][chainId].isVerified = true;
    writeFile(file);
  } else {
    console.log('Skipping Etherscan verification...');
  }
}

export async function prettyPrintEncodedData(
  transactionPromise: Promise<PopulatedTransaction>,
  methodName: string,
): Promise<void> {
  const transaction = await transactionPromise;
  console.log(`=================================== ${methodName} ===================================`);
  console.log('To: ', transaction.to);
  console.log('Data: ', transaction.data);
  console.log('='.repeat(72 + methodName.length));
}

function writeFile(file: any) {
  fs.writeFileSync('./scripts/deployments.json', JSON.stringify(file, null, 2), { encoding: 'utf8', flag: 'w' });
}
