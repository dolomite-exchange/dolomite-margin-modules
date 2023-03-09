import { address } from '@dolomite-exchange/dolomite-margin';
import { sleep } from '@openzeppelin/upgrades';
import fs from 'fs';
import { network, run } from 'hardhat';
import { createContract } from '../src/utils/dolomite-utils';

type ChainId = string;

export async function verifyContract(address: string, constructorArguments: any[]) {
  try {
    await run('verify:verify', {
      address,
      constructorArguments,
    });
  } catch (e: any) {
    if (e?.message.toLowerCase().includes('already verified')) {
      console.log('EtherscanVerification: Swallowing already verified error');
    } else {
      throw e;
    }
  }
}

export async function deployContractAndSave(
  chainId: number,
  contractName: string,
  args: any[],
): Promise<address> {
  const fileBuffer = fs.readFileSync('./scripts/deployments.json');

  let file: Record<string, Record<ChainId, any>>;
  try {
    file = JSON.parse(fileBuffer.toString()) ?? {};
  } catch (e) {
    file = {};
  }

  if (file[contractName]?.[chainId.toString()]) {
    console.log(`Contract ${contractName} has already been deployed to chainId ${chainId}. Skipping...`);
    const contract = file[contractName][chainId.toString()];
    if (!contract.isVerified) {
      await prettyPrintAndVerifyContract(file, chainId, contractName, args);
    }
    return contract.address;
  }

  console.log(`Deploying ${contractName} to chainId ${chainId}...`);

  const contract = await createContract(contractName, args);

  file[contractName] = {
    ...file[contractName],
    [chainId]: {
      address: contract.address,
      transaction: contract.deployTransaction.hash,
      isVerified: false,
    },
  };

  if (network.name !== 'hardhat') {
    writeFile(file);
  }

  await prettyPrintAndVerifyContract(file, chainId, contractName, args);

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

function writeFile(file: any) {
  fs.writeFileSync('./scripts/deployments.json', JSON.stringify(file, null, 2), { encoding: 'utf8', flag: 'w' });
}
