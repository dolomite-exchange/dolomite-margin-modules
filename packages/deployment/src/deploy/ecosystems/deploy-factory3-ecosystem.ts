import { getAnyNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import {
  NETWORK_TO_NETWORK_NAME_MAP,
  NetworkType,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { sleep } from '@openzeppelin/upgrades';
import { parseEther } from 'ethers/lib/utils';
import hardhat, { ethers } from 'hardhat';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getRealLatestBlockNumber, impersonate, resetForkIfPossible } from 'packages/base/test/utils';
import { deployContractAndSave, getBuildInfoFromDebugFileSync, isDeployed } from '../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../utils/dry-run-utils';
import getScriptName from '../../utils/get-script-name';

const FACTORY_DEPLOYER = '0x4427040bBbc8084Acf86ff409e84a83B3FaD9e85';
const EXPECTED_CREATE3_FACTORY_ADDRESS = '0xa8F7e7A361De6A2172fcb2accE68bd21597599F7';

async function main<T extends NetworkType>(): Promise<DryRunOutput<T>> {
  const network = (await getAnyNetwork()) as T;
  const networkName = NETWORK_TO_NETWORK_NAME_MAP[network];
  await resetForkIfPossible(await getRealLatestBlockNumber(true, network), network);

  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY as string);
  let hhUser1;
  if (hardhat.network.name === 'hardhat') {
    hhUser1 = await impersonate(wallet.address);
  } else {
    hhUser1 = wallet.connect(ethers.provider);
  }

  assertHardhatInvariant(
    hhUser1.address === FACTORY_DEPLOYER,
    `Invalid signer, found ${hhUser1.address} but expected ${FACTORY_DEPLOYER}`,
  );

  const contractName = 'CREATE3Factory';
  const CREATE3FactoryArtifact = require(`packages/deployment/artifacts-saved/contracts/${contractName}.sol/${contractName}.json`);
  await hardhat.artifacts.saveArtifactAndDebugFile(
    CREATE3FactoryArtifact,
    getBuildInfoFromDebugFileSync(`artifacts-saved/contracts/${contractName}.sol/${contractName}.dbg.json`),
  );

  const bytecodeWithArgs = CREATE3FactoryArtifact.bytecode;
  const gasLimit = ethers.BigNumber.from(hardhat.config.networks[networkName].gas);
  const gasPrice = (await ethers.provider.getGasPrice()).mul(2);
  const gasCost = (await ethers.provider.estimateGas({ data: bytecodeWithArgs })).mul(15).div(10);
  console.log(`\tExpected gas cost: ${gasCost.toString()}`);

  const gasLimitPercentageAboveCost = gasLimit.mul(100).div(gasCost).sub(100);
  console.log(`\tgasLimit: ${gasLimit} (${gasLimitPercentageAboveCost}% above expected cost)`);
  if (gasLimitPercentageAboveCost.lt(ZERO_BI)) {
    return Promise.reject(new Error("gasLimit isn't high enough to proceed"));
  }
  if (gasLimitPercentageAboveCost.lt(10)) {
    console.log(
      "\tgasLimit may be too low to accommodate for possibly increasing future opcode cost. Once you choose a gasLimit, you'll need to use the same value for deployments on other blockchains any time in the future in order for your contract to have the same address.",
    );
  }

  const deployerPrivateKey = new ethers.Wallet(
    ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(['bytes32', 'string'], [wallet.privateKey, contractName]),
    ),
    ethers.provider,
  );

  if (!isDeployed(contractName) && gasPrice.mul(gasCost).gt(await deployerPrivateKey.getBalance())) {
    // perform a transfer to the deployer wallet
    console.log(`\tPerforming transfer to intermediate deployer: ${hhUser1.address} --> ${deployerPrivateKey.address}`);
    const result = await hhUser1.sendTransaction({
      to: deployerPrivateKey.address,
      value: gasPrice.mul(gasCost).sub(await deployerPrivateKey.getBalance()),
    });
    await result.wait();
    await sleep(3_000); // wait 3 seconds for the transaction to settle
  }

  const create3FactoryAddress = await deployContractAndSave(contractName, [], undefined, undefined, {
    gasPrice: gasPrice.mul(9).div(10),
    gasLimit: gasCost,
    nonce: 0,
    type: 0,
    skipArtifactInitialization: true,
    signer: deployerPrivateKey,
  });

  if ((await deployerPrivateKey.getBalance()).gt(ZERO_BI)) {
    // perform a transfer to the deployer wallet
    const balance = await deployerPrivateKey.getBalance();

    const gasLimit = await deployerPrivateKey.provider.estimateGas({
      to: hhUser1.address,
      value: balance,
    });
    const gasPrice = (await deployerPrivateKey.provider.getGasPrice()).mul(11).div(10);
    const totalGasFee = gasPrice.mul(gasLimit);

    if (balance.gt(totalGasFee) && balance.gt(parseEther('0.00001'))) {
      console.log(`\tSweeping payable to main deployer: ${deployerPrivateKey.address} --> ${hhUser1.address}`);
      const maxAttempts = 3;
      for (let i = 0; i < maxAttempts; i++) {
        try {
          const result = await deployerPrivateKey.sendTransaction({
            gasLimit,
            gasPrice,
            to: hhUser1.address,
            type: 0,
            value: balance
              .sub(totalGasFee)
              .mul(20 - i)
              .div(20), // subtract 5% for each failed transaction
          });
          await result.wait();
          await sleep(3_000); // wait 3 seconds for the transaction to settle
          break;
        } catch (e) {
          if (i === maxAttempts - 1) {
            console.log(`\tCould not sweep funds after ${maxAttempts} attempts`);
          }
        }
      }
    }
  }

  return {
    core: {} as any,
    scriptName: getScriptName(__filename),
    upload: {
      transactions: [],
      chainId: network,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: 'CREATE3 Factory',
      },
    },
    invariants: async () => {
      assertHardhatInvariant(
        create3FactoryAddress === EXPECTED_CREATE3_FACTORY_ADDRESS,
        `Invalid CREATE3 Factory address, expected: ${create3FactoryAddress}`,
      );
    },
  };
}

// noinspection JSIgnoredPromiseFromCall
doDryRunAndCheckDeployment(main);