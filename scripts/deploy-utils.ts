import fs from 'fs';
import { network, run } from 'hardhat';
import { createContract } from '../src/utils/dolomite-utils';

type ChainId = string;

async function verifyContract(address: string, constructorArguments: any[]) {
  try {
    await run('verify:verify', {
      address: address,
      constructorArguments: constructorArguments,
    });
  } catch (e: any) {
    if (e?.message.includes('Already Verified')) {
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
) {
  const fileBuffer = fs.readFileSync('./scripts/deployments.json');

  let file: Record<string, Record<ChainId, any>>;
  try {
    file = JSON.parse(fileBuffer.toString()) ?? {};
  } catch (e) {
    file = {};
  }

  if (file[contractName]?.[chainId.toString()]) {
    console.log(`Contract ${contractName} has already been deployed to chainId ${chainId}. Skipping...`);
    return
  }

  console.log(`Deploying ${contractName} to chainId ${chainId}...`);

  const contract = await createContract(contractName, args);

  file[contractName] = {
    ...file[contractName],
    [chainId]: {
      address: contract.address,
      transaction: contract.deployTransaction.hash,
    },
  }

  if (network.name !== 'hardhat') {
    fs.writeFileSync('./scripts/deployments.json', JSON.stringify(file, null, 2), { encoding: 'utf8', flag: 'w' });
  }

  console.log(`========================= ${contractName} =========================`)
  console.log('Address: ', contract.address);
  console.log('='.repeat(52 + contractName.length));

  if (network.name !== 'hardhat') {
    await verifyContract(contract.address, [...args]);
  } else {
    console.log('Skipping Etherscan verification...')
  }
}
