import { getAnyNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import {
  DolomiteNetwork,
  NETWORK_TO_NETWORK_NAME_MAP,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { sleep } from '@openzeppelin/upgrades';
import hardhat, { ethers } from 'hardhat';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getRealLatestBlockNumber, resetForkIfPossible } from 'packages/base/test/utils';
import {
  deployContractAndSave,
  getBuildInfoFromDebugFileSync,
  getDeployerSigner,
  isDeployed,
} from '../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../utils/dry-run-utils';
import getScriptName from '../../utils/get-script-name';

const FACTORY_DEPLOYER = '0x4427040bBbc8084Acf86ff409e84a83B3FaD9e85';
const EXPECTED_CREATE3_FACTORY_ADDRESS = '0xa8F7e7A361De6A2172fcb2accE68bd21597599F7';

async function main<T extends DolomiteNetwork>(): Promise<DryRunOutput<T>> {
  const network = (await getAnyNetwork()) as T;
  const networkName = NETWORK_TO_NETWORK_NAME_MAP[network];
  await resetForkIfPossible(await getRealLatestBlockNumber(true, network), network);

  const { signer: hhUser1, wallet } = await getDeployerSigner();

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
  const gasPrice = (await ethers.provider.getGasPrice()).mul(4);
  const gasCost = (await ethers.provider.estimateGas({ data: bytecodeWithArgs })).mul(2);
  console.log(`\tExpected gas price: ${gasPrice.toString()}`);
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

  const deployerBalance = await deployerPrivateKey.getBalance();
  console.log('\tDeployer balance:', deployerBalance.toString(), `(${ethers.utils.formatEther(deployerBalance)} ETH)`);
  console.log(
    '\tTotal gas cost:',
    gasPrice.mul(gasCost).toString(),
    `(${ethers.utils.formatEther(gasPrice.mul(gasCost))} ETH)`,
  );

  if (!isDeployed(contractName) && gasPrice.mul(gasCost).gt(deployerBalance)) {
    // perform a transfer to the deployer wallet
    const amount = gasPrice.mul(gasCost).sub(deployerBalance);
    console.log(
      `\tPerforming transfer to intermediate deployer: ${hhUser1.address} --> ${
        deployerPrivateKey.address
      } ${ethers.utils.formatEther(amount)} ETH`,
    );
    const result = await hhUser1.sendTransaction({
      to: deployerPrivateKey.address,
      value: amount,
      gasPrice: gasPrice.mul(2).div(3),
      type: 0,
    });
    await result.wait();
    await sleep(5_000); // wait 5 seconds for the transaction to settle
  }

  const create3FactoryAddress = await deployContractAndSave(contractName, [], undefined, undefined, {
    gasPrice: gasPrice.mul(2).div(3),
    gasLimit: gasCost,
    nonce: 0,
    type: 0,
    skipArtifactInitialization: true,
    signer: deployerPrivateKey,
  });

  if ((await deployerPrivateKey.getBalance()).gt(ZERO_BI)) {
    await sleep(5_000); // wait 5 seconds for the deployment transaction to settle

    // perform a transfer to the deployer wallet
    const balance = await deployerPrivateKey.getBalance();

    const gasPrice = (await deployerPrivateKey.provider.getGasPrice()).mul(11).div(10);
    const totalGasFee = gasPrice.mul(gasLimit);

    if (balance.gt(totalGasFee)) {
      console.log(`\tSweeping payable to main deployer: ${deployerPrivateKey.address} --> ${hhUser1.address}`);
      const maxAttempts = 3;
      for (let i = 0; i < maxAttempts; i++) {
        try {
          const result = await deployerPrivateKey.sendTransaction({
            gasPrice,
            gasLimit: 21_000,
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
