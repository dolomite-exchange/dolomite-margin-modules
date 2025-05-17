import { getAnyNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { DolomiteNetwork, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '@dolomite-exchange/modules-base/src/utils/SignerWithAddressWithSafety';
import { getRealLatestBlockNumber, resetForkIfPossible } from '@dolomite-exchange/modules-base/test/utils';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../utils/dry-run-utils';
import getScriptName from '../../utils/get-script-name';

const golemMultisigAbi =
  '[{"constant":true,"inputs":[{"name":"","type":"bytes32"},{"name":"","type":"address"}],"name":"confirmations","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"destination","type":"address"},{"name":"value","type":"uint256"},{"name":"data","type":"bytes"},{"name":"nonce","type":"uint256"}],"name":"submitTransaction","outputs":[{"name":"transactionHash","type":"bytes32"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"owner","type":"address"}],"name":"removeOwner","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"isOwner","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"transactionHash","type":"bytes32"}],"name":"confirmationCount","outputs":[{"name":"count","type":"uint256"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_required","type":"uint256"}],"name":"updateRequired","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"","type":"bytes32"}],"name":"transactions","outputs":[{"name":"destination","type":"address"},{"name":"value","type":"uint256"},{"name":"data","type":"bytes"},{"name":"nonce","type":"uint256"},{"name":"executed","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"transactionHash","type":"bytes32"}],"name":"isConfirmed","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"owner","type":"address"}],"name":"addOwner","outputs":[],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"transactionHash","type":"bytes32"}],"name":"confirmTransaction","outputs":[],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"destination","type":"address"},{"name":"value","type":"uint256"},{"name":"data","type":"bytes"},{"name":"nonce","type":"uint256"},{"name":"v","type":"uint8[]"},{"name":"rs","type":"bytes32[]"}],"name":"submitTransactionWithSignatures","outputs":[{"name":"transactionHash","type":"bytes32"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"transactionHash","type":"bytes32"}],"name":"executeTransaction","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"getPendingTransactions","outputs":[{"name":"_transactionList","type":"bytes32[]"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"required","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"getExecutedTransactions","outputs":[{"name":"_transactionList","type":"bytes32[]"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"transactionHash","type":"bytes32"}],"name":"revokeConfirmation","outputs":[],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"transactionHash","type":"bytes32"},{"name":"v","type":"uint8[]"},{"name":"rs","type":"bytes32[]"}],"name":"confirmTransactionWithSignatures","outputs":[],"payable":false,"type":"function"},{"inputs":[{"name":"_owners","type":"address[]"},{"name":"_required","type":"uint256"}],"type":"constructor"},{"payable":true,"type":"fallback"},{"anonymous":false,"inputs":[{"indexed":false,"name":"sender","type":"address"},{"indexed":false,"name":"transactionHash","type":"bytes32"}],"name":"Confirmation","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"sender","type":"address"},{"indexed":false,"name":"transactionHash","type":"bytes32"}],"name":"Revocation","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"transactionHash","type":"bytes32"}],"name":"Submission","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"transactionHash","type":"bytes32"}],"name":"Execution","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"sender","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Deposit","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"owner","type":"address"}],"name":"OwnerAddition","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"owner","type":"address"}],"name":"OwnerRemoval","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"required","type":"uint256"}],"name":"RequiredUpdate","type":"event"}]';
const golemMultiSigAddress = '0x7da82c7ab4771ff031b66538d2fb9b0b047f6cf9';

async function main<T extends DolomiteNetwork>(): Promise<DryRunOutput<T>> {
  const network = (await getAnyNetwork()) as T;
  const networkName = 'mainnet';
  await resetForkIfPossible(await getRealLatestBlockNumber(true, network, networkName), network, networkName);
  const [hhUser1] = await Promise.all(
    (await ethers.getSigners()).map((s) => SignerWithAddressWithSafety.create(s.address)),
  );

  const contract = new ethers.Contract(golemMultiSigAddress, golemMultisigAbi, hhUser1);
  const pendingTransactions = (await contract.functions.getPendingTransactions())._transactionList as string[];
  console.log(`Found ${pendingTransactions.length} pending transactions`);

  let total = ZERO_BI;
  for (let i = 0; i < pendingTransactions.length; i++) {
    const transaction = await contract.functions.transactions(pendingTransactions[i]);
    if (BigNumber.from(transaction.value).gt(ZERO_BI)) {
      total = total.add(transaction.value);
      console.log(
        `Found transaction to ${transaction.destination} for ${ethers.utils.formatUnits(transaction.value)} ETH`,
      );
    }
  }
  console.log(`Found ${ethers.utils.formatUnits(total)} unsent ETH in total`);

  return {
    core: null as any,
    invariants: async () => {},
    scriptName: getScriptName(__filename),
    upload: {
      transactions: [],
      chainId: network,
    },
  };
}

// noinspection JSIgnoredPromiseFromCall
doDryRunAndCheckDeployment(main);
