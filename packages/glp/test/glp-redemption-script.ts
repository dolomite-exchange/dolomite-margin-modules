import axios from 'axios';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther, parseUnits } from 'ethers/lib/utils';
import { createContractWithAbi, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { Network, ONE_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { impersonate, revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectProtocolBalance, expectThrow } from 'packages/base/test/utils/assertions';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { disableInterestAccrual, setupCoreProtocol, setupNativeUSDCBalance, setupUSDCBalance } from 'packages/base/test/utils/setup';
import {
  GLPIsolationModeTokenVaultV3Paused,
  GLPIsolationModeTokenVaultV3Paused__factory,
  GLPRedemptionOperator,
  GLPRedemptionOperator__factory,
} from 'packages/glp/src/types';

const USDC_REDEMPTION_AMOUNT = BigNumber.from('176953980000');
const GLP_SUPPLIED_AMOUNT = BigNumber.from('134145049679972225550400');

const userAddress = '0xae7ae37d9D97ABc1099995036f17701fd55cefE5';
const glpVaultAddress = '0x121228cBAF3f3615b5b99F6B41bED5e536f8C19a'; // roughly 14 GLP in 0, 2.8 ish in borrow account

const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = BigNumber.from('64870034939730665364032064862425947019883560685074554993543589166029552275672');
const defaultOutputWbtc = BigNumber.from('1297');
const borrowOutputWbtc = BigNumber.from('259');

const glpUnwrapperTraderAddress = '0xaacDc43568f9adC4D3b67a26BD04159Ded39D79d';

describe('glp-redemption-script', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let redemptionOperator: GLPRedemptionOperator;

  let user: SignerWithAddressWithSafety;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 377_031_000,
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
        core.gmxEcosystem.live.dGlp.address,
        glpUnwrapperTraderAddress,
        core.dolomiteMargin.address
      ]
    );

    // @audit Make sure there are no issues with freezable where user can use the vault when we set the token converter
    await core.gmxEcosystem.live.dGlp.connect(core.governance).setIsTokenConverterTrusted(
      glpUnwrapperTraderAddress,
      true
    );
    await core.liquidatorAssetRegistry.connect(core.governance).ownerAddLiquidatorToAssetWhitelist(
      core.marketIds.dfsGlp,
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
      // USDC amount => 176,953.9800

      // get all users with balance at block number
      const url = 'https://api.dolomite.io/balances/42161/6?blockNumber=355880236';
      const response = await fetch(url);
      const data = await response.json();

      for (const user of data['Result']) {
        // get user full reward amount
        const effectiveBalance = parseEther(user['effective_balance']);
        const fullRewardAmount = effectiveBalance.mul(USDC_REDEMPTION_AMOUNT).div(GLP_SUPPLIED_AMOUNT);

        // get user positions
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
        }`

        const result = await axios.post(
          'https://api.goldsky.com/api/public/project_clyuw4gvq4d5801tegx0aafpu/subgraphs/dolomite-arbitrum/latest/gn',
          {
            query,
          },
        ).then(response => response.data.data.marginAccounts);

        let usedRewardAmount = ZERO_BI
        for (const marginAccount of result) {
          if (marginAccount.accountNumber == 0) {
            continue;
          }

          expect(marginAccount.tokenValues.length).to.eq(1);
          expect(marginAccount.tokenValues[0].token.id).to.eq(core.tokens.dfsGlp.address.toLowerCase());

          const glpBal = parseEther(marginAccount.tokenValues[0].valuePar);
          const usdcRedemptionAmount = glpBal.mul(USDC_REDEMPTION_AMOUNT).div(GLP_SUPPLIED_AMOUNT);
          usedRewardAmount = usedRewardAmount.add(usdcRedemptionAmount);

          // set usdc redemption amount per user account
          await redemptionOperator.connect(core.hhUser4).handlerSetUsdcRedemptionAmounts(
            [glpVaultAddress],
            [marginAccount.accountNumber],
            [usdcRedemptionAmount]
          );

          // call handlerRedeemGLP for each user
          await redemptionOperator.connect(core.hhUser4).handlerRedeemGLP(
            glpVaultAddress,
            marginAccount.accountNumber,
            core.marketIds.wbtc,
            ONE_BI // would need to update this
          );
        }

        // handle default account
        const defaultRewardAmount = fullRewardAmount.sub(usedRewardAmount);
        await redemptionOperator.connect(core.hhUser4).handlerSetUsdcRedemptionAmounts(
          [glpVaultAddress],
          [defaultAccountNumber],
          [defaultRewardAmount]
        );
        await redemptionOperator.connect(core.hhUser4).handlerRedeemGLP(
          glpVaultAddress,
          defaultAccountNumber,
          core.marketIds.wbtc,
          ONE_BI // would need to update this
        );
        console.log('User done: ', user['address']);
      }
    });
  });
});
