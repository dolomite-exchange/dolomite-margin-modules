import axios from 'axios';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { createContractWithAbi, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { Network, ONE_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { disableInterestAccrual, setupCoreProtocol, setupNativeUSDCBalance } from 'packages/base/test/utils/setup';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { GLPRedemptionOperator, GLPRedemptionOperator__factory } from 'packages/glp/src/types';

const USDC_REDEMPTION_AMOUNT = BigNumber.from('23815570107');
const PLV_GLP_SUPPLIED_AMOUNT = BigNumber.from('86508778219424211603124');
const defaultAccountNumber = ZERO_BI;

const PLV_GLP_UNWRAPPER_TRADER_ADDRESS = '0x74D3Cb3955E7517AeC82D391C5767BE50DBa575f';

describe('plv-glp-redemption-script', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let redemptionOperator: GLPRedemptionOperator;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 382_895_500,
      network: Network.ArbitrumOne,
    });
    await disableInterestAccrual(core, core.marketIds.usdc);
    await disableInterestAccrual(core, core.marketIds.wbtc);

    redemptionOperator = await createContractWithAbi<GLPRedemptionOperator>(
      GLPRedemptionOperator__factory.abi,
      GLPRedemptionOperator__factory.bytecode,
      [
        core.hhUser4.address, // handler
        core.hhUser5.address, // usdc fund
        core.marketIds.nativeUsdc,
        core.plutusEcosystem.live.dPlvGlp.address,
        PLV_GLP_UNWRAPPER_TRADER_ADDRESS,
        core.dolomiteMargin.address
      ]
    );

    await core.liquidatorAssetRegistry.connect(core.governance).ownerAddLiquidatorToAssetWhitelist(
      core.marketIds.dplvGlp,
      redemptionOperator.address
    );
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(redemptionOperator.address, true);

    await setupNativeUSDCBalance(core, core.hhUser5, USDC_REDEMPTION_AMOUNT, core.dolomiteMargin);
    await depositIntoDolomiteMargin(
      core,
      core.hhUser5,
      defaultAccountNumber,
      core.marketIds.nativeUsdc,
      USDC_REDEMPTION_AMOUNT
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#script', () => {
    it('should work normally', async () => {
      /**
       * Set the redemption amounts for all users
       */

      // get all users with balance at block number
      const url = 'https://api.dolomite.io/balances/42161/9?blockNumber=355880236';
      const response = await fetch(url);
      const data = await response.json();

      let sum = ZERO_BI;
      for (const user of data['Result']) {
        // get user full reward amount
        const effectiveBalance = parseEther(user['effective_balance']);
        const vaultAddress = await core.plutusEcosystem.live.dPlvGlp.getVaultByAccount(user['address']);
        expect(vaultAddress).to.not.eq(ZERO_ADDRESS);
        const query = `
        {
          marginAccounts(
            where: {supplyTokens_: {id: "0x5c80aC681B6b0E7EF6E0751211012601e6cFB043"}, user: "${vaultAddress.toLowerCase()}"}
          ) {
            accountNumber
            id
            user {
              id
            }
            tokenValues(where: { token: "0x5c80aC681B6b0E7EF6E0751211012601e6cFB043" }) {
              valuePar
              token {
                id
                name
              }
            }
          }
        }`;

        const result = await axios.post(
          'https://api.goldsky.com/api/public/project_clyuw4gvq4d5801tegx0aafpu/subgraphs/dolomite-arbitrum/latest/gn',
          {
            query,
          },
        ).then(response => response.data.data.marginAccounts);

        const fullRewardAmount = effectiveBalance.mul(USDC_REDEMPTION_AMOUNT).div(PLV_GLP_SUPPLIED_AMOUNT);
        let usedRewardAmount = ZERO_BI;

        const accountNumbers = [];
        const usdcRedemptionAmounts = [];
        for (const marginAccount of result) {
          if (marginAccount.accountNumber === '0') {
            continue;
          }

          expect(marginAccount.tokenValues.length).to.eq(1);
          expect(marginAccount.tokenValues[0].token.id).to.eq(core.plutusEcosystem.live.dPlvGlp.address.toLowerCase());

          const plvGlpBal = parseEther(marginAccount.tokenValues[0].valuePar);
          const accountAmount = plvGlpBal.mul(fullRewardAmount).div(effectiveBalance);
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
          await redemptionOperator.connect(core.hhUser4).handlerSetRedemptionAmounts(
            vaultAddress,
            accountNumbers,
            usdcRedemptionAmounts
          );
        }
        const userSum = usdcRedemptionAmounts.reduce((acc: BigNumber, n) => acc.add(n), BigNumber.from('0'));
        expect(userSum).to.eq(fullRewardAmount);
        sum = sum.add(userSum);
      }
      expect(sum).to.lte(USDC_REDEMPTION_AMOUNT);
      expect(sum).to.gt(USDC_REDEMPTION_AMOUNT.sub(BigNumber.from('1000000'))); // sub 1 usdc for rounding

      /**
       * Execute each vault
       */

      for (const user of data['Result']) {
        const vaultAddress = await core.plutusEcosystem.live.dPlvGlp.getVaultByAccount(user['address']);
        const query = `
        {
          marginAccounts(
            where: {supplyTokens_: {id: "0x5c80aC681B6b0E7EF6E0751211012601e6cFB043"}, user: "${vaultAddress.toLowerCase()}"}
          ) {
            accountNumber
            id
            user {
              id
            }
            tokenValues(where: { token: "0x5c80aC681B6b0E7EF6E0751211012601e6cFB043" }) {
              valuePar
              token {
                id
                name
              }
            }
          }
        }`;

        const result = await axios.post(
          'https://api.goldsky.com/api/public/project_clyuw4gvq4d5801tegx0aafpu/subgraphs/dolomite-arbitrum/latest/gn',
          {
            query,
          },
        ).then(response => response.data.data.marginAccounts);

        const redemptionParams = [];
        for (const marginAccount of result) {
          const plvGlpBal = parseEther(marginAccount.tokenValues[0].valuePar);
          const outputMarket = plvGlpBal.lte(parseEther('.02')) ? core.marketIds.usdc : core.marketIds.wbtc;
          redemptionParams.push({
            accountNumber: marginAccount.accountNumber,
            outputMarketId: outputMarket,
            minOutputAmountWei: ONE_BI
          });
        }

        try {
          await redemptionOperator.connect(core.hhUser4).handlerExecuteVault(
            vaultAddress,
            redemptionParams
          );
        } catch (error) {
          console.log(`Error executing vault for ${user['address']}: ${error}`);
        }
        console.log(`Executed vault for ${user['address']}`);
      }
    });
  });
});
