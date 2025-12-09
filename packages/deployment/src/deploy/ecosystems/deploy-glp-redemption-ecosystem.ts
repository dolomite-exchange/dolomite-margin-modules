import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import axios from 'axios';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { readFileSync } from 'fs';
import { writeFile } from 'fs-extra';
import hardhat from 'hardhat';
import { ADDRESS_ZERO, Network, ONE_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { GLPRedemptionOperator__factory } from 'packages/glp/src/types';
import { ModuleDeployments } from '../../utils';

const VAULTS_PATH = `${__dirname}/../../../../glp/glp-snapshot-holders-block-355880236.json`;
const USDC_REDEMPTION_AMOUNT = BigNumber.from('176953980000');
const GLP_SUPPLIED_AMOUNT = BigNumber.from('134145049679972225550400');

async function main() {
  const network = Network.ArbitrumOne;
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const redemptionOperator = GLPRedemptionOperator__factory.connect(
    ModuleDeployments.GLPRedemptionOperatorV1[network].address,
    core.hhUser1,
  );

  const allUsers = JSON.parse(readFileSync(VAULTS_PATH).toString()) as any[];
  for (const user of allUsers) {
    if (user['isSet']) {
      continue;
    }

    const effectiveBalance = parseEther(user['effective_balance']);
    const vaultAddress = await core.gmxEcosystem.live.dGlp.getVaultByAccount(user['address']);
    const query = `
        {
          marginAccounts(
            where: {supplyTokens_: {id: "0x34df4e8062a8c8ae97e3382b452bd7bf60542698"}, user: "${vaultAddress.toLowerCase()}"}
          ) {
            accountNumber
            id
            user {
              id
            }
            tokenValues(where: { token: "0x34df4e8062a8c8ae97e3382b452bd7bf60542698" }) {
              valuePar
              token {
                id
                name
              }
            }
          }
        }`;

    const result = await axios
      .post(
        'https://api.goldsky.com/api/public/project_clyuw4gvq4d5801tegx0aafpu/subgraphs/dolomite-arbitrum/latest/gn',
        {
          query,
        },
      )
      .then((response) => response.data.data.marginAccounts);

    const fullRewardAmount = effectiveBalance.mul(USDC_REDEMPTION_AMOUNT).div(GLP_SUPPLIED_AMOUNT);
    let usedRewardAmount = ZERO_BI;

    const accountNumbers = [];
    const usdcRedemptionAmounts = [];
    for (const marginAccount of result) {
      if (marginAccount.accountNumber === '0') {
        continue;
      }

      expect(marginAccount.tokenValues.length).to.eq(1);
      expect(marginAccount.tokenValues[0].token.id).to.eq(core.tokens.dfsGlp.address.toLowerCase());

      const glpBal = parseEther(marginAccount.tokenValues[0].valuePar);
      const accountAmount = glpBal.mul(fullRewardAmount).div(effectiveBalance);
      accountNumbers.push(marginAccount.accountNumber);
      usdcRedemptionAmounts.push(accountAmount);

      usedRewardAmount = usedRewardAmount.add(accountAmount);
    }

    // Set redemption amounts
    const defaultRewardAmount = fullRewardAmount.sub(usedRewardAmount);
    if (defaultRewardAmount.gt(ZERO_BI)) {
      accountNumbers.push('0');
      usdcRedemptionAmounts.push(defaultRewardAmount);
    }
    expect(accountNumbers.length).to.eq(usdcRedemptionAmounts.length);
    if (accountNumbers.length > 0) {
      await redemptionOperator.handlerSetRedemptionAmounts(vaultAddress, accountNumbers, usdcRedemptionAmounts);
    }
    const userSum = usdcRedemptionAmounts.reduce((acc: BigNumber, n) => acc.add(n), BigNumber.from('0'));
    expect(userSum).to.eq(fullRewardAmount);

    if (hardhat.network.name !== 'hardhat') {
      user['isSet'] = true;
      await writeFile(VAULTS_PATH, JSON.stringify(allUsers, null, 2));
    }
  }

  for (const user of allUsers) {
    if (user['isExecuted'] || user['isFailure']) {
      continue;
    }

    const vaultAddress = await core.gmxEcosystem.live.dGlp.getVaultByAccount(user.address);
    if (vaultAddress === ADDRESS_ZERO) {
      throw new Error('Invalid!');
    }

    const query = `
        {
          marginAccounts(
            where: {supplyTokens_: {id: "0x34df4e8062a8c8ae97e3382b452bd7bf60542698"}, user: "${vaultAddress.toLowerCase()}"}
          ) {
            accountNumber
            id
            user {
              id
            }
            tokenValues(where: { token: "0x34df4e8062a8c8ae97e3382b452bd7bf60542698" }) {
              valuePar
              token {
                id
                name
              }
            }
          }
        }`;

    const result = await axios
      .post(
        'https://api.goldsky.com/api/public/project_clyuw4gvq4d5801tegx0aafpu/subgraphs/dolomite-arbitrum/latest/gn',
        {
          query,
        },
      )
      .then((response) => response.data.data.marginAccounts);

    const redemptionParams = [];
    for (const marginAccount of result) {
      const glpBal = parseEther(marginAccount.tokenValues[0].valuePar);
      const outputMarket = glpBal.lte(parseEther('.02')) ? core.marketIds.usdc : core.marketIds.wbtc;
      redemptionParams.push({
        accountNumber: marginAccount.accountNumber,
        outputMarketId: outputMarket,
        minOutputAmountWei: ONE_BI,
      });
    }

    try {
      const transaction = await redemptionOperator.handlerExecuteVault(vaultAddress, redemptionParams, {
        gasLimit: 15_000_000,
      });
      const receipt = await transaction.wait();
      if (!receipt.status) {
        user['isFailure'] = true;
      } else {
        user['isExecuted'] = true;
      }
    } catch (e: any) {
      user['isFailure'] = true;
    }

    if (hardhat.network.name !== 'hardhat') {
      await writeFile(VAULTS_PATH, JSON.stringify(allUsers, null, 2));
    }

    if (user['isFailure']) {
      console.log(`Invalid transaction for ${vaultAddress}`);
    } else if (user['isExecuted']) {
      console.log(`Executed vault for ${vaultAddress}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
