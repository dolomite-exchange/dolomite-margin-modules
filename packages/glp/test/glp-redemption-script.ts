import axios from 'axios';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { createContractWithAbi, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { Network, ONE_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { disableInterestAccrual, setupCoreProtocol, setupNativeUSDCBalance } from 'packages/base/test/utils/setup';
import {
  GLPRedemptionOperator,
  GLPRedemptionOperator__factory,
} from 'packages/glp/src/types';

const USDC_REDEMPTION_AMOUNT = BigNumber.from('176953980000');
const GLP_SUPPLIED_AMOUNT = BigNumber.from('134145049679972225550400');
const defaultAccountNumber = ZERO_BI;

const glpUnwrapperTraderAddress = '0xaacDc43568f9adC4D3b67a26BD04159Ded39D79d';

// Bad users:  [
//   '0x02b72485ecdaabd5f9af68d9a5d2b2ca54d5339b',
//   '0xfb408fa20c6f6da099a7492107bc3531911896e3',
//   '0x97a7ec1b7157d12b99fb43d54f206ab9745a23dd',
//   '0x72195dda0361f43ce544b750f318d04b35836933',
//   '0x545b0cd987cfc162e5118eed0a21adb6e4968533',
//   '0x5253752071aeaa485040b368ab6ecb49e3bdd68d',
//   '0xd36ddb07b9bba83a2aefc8272c40bcaf6843eb0e',
//   '0x5b2d776723f14c881bc69b5a479fa7ea0e6e3dc1',
//   '0xe9417f49d7301ee3931ec023803710a1001d8dad',
//   '0x622eaa37f684496216d4ea87709711b03f51b056',
//   '0x2218a37513b2bdd11226e43a22ce6732bf07323b',
//   '0x8c580556fdb1f57853e49f409ae9b89f7658e7a2',
//   '0xf42c2b956bcab51abb6555f5a06ee582e4581c71',
//   '0x0d3e354fadfa4e2f8f596a3f089a49fae4995bb0',
//   '0x4614b16551a21f7e29b57a4f8a8a4b63579d3cf4',
//   '0x4614b16551a21f7e29b57a4f8a8a4b63579d3cf4',
//   '0x25c68aa03c5197b643e5a6bceb13289e9874344d',
//   '0x57f5e6359497f74fa7bee41a7129695d9505845e',
//   '0x21cd90999c0ff1ebab47b8adbdd6204715320f39',
//   '0x0b268ed6c35b187e781dbe92d02ba78fbc2ab9b7',
//   '0x6409655c63a843cfc056e811b376debead767a5c',
//   '0xcbc2ee786c1893811ae64584d1547cee05edeea5',
//   '0x15f55e3d1dcaa88d16732808c2df5f8438f11a9f',
//   '0x1a7228605ad816861b61e9ec1944346660fe52d7',
//   '0xa6323e19ea4b1f74499de026691239c69508888a',
//   '0x4c30ffc4945b6297fa75bd0931f937ea7bc8e9b2',
//   '0xf23ca6755d7f6a715b3e1e12816dbf9a899ea519',
//   '0x55432fda702a12e32c3d44c5c90533fe4daff779',
//   '0xc9af09e3f0fe8e35d533eb62e4fec19c309ee1cd',
//   '0xe6656eb70af7d8c489eae135bae1b53c2a261a68',
//   '0xb3d79ea767610555eba816bf79c7a1be14f81c7c'
// ]

describe('glp-redemption-script', () => {
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
      // get all users with balance at block number
      const url = 'https://api.dolomite.io/balances/42161/6?blockNumber=355880236';
      const response = await fetch(url);
      const data = await response.json();
      const badUsers = [];

      for (const user of data['Result']) {
        // get user full reward amount
        const effectiveBalance = parseEther(user['effective_balance']);
        const fullRewardAmount = effectiveBalance.mul(USDC_REDEMPTION_AMOUNT).div(GLP_SUPPLIED_AMOUNT);

        // get current user positions
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
        let defaultAccountBal = ZERO_BI;
        for (const marginAccount of result) {
          if (marginAccount.accountNumber == 0) {
            defaultAccountBal = parseEther(marginAccount.tokenValues[0].valuePar);
            continue;
          }

          expect(marginAccount.tokenValues.length).to.eq(1);
          expect(marginAccount.tokenValues[0].token.id).to.eq(core.tokens.dfsGlp.address.toLowerCase());

          const glpBal = parseEther(marginAccount.tokenValues[0].valuePar);
          const usdcRedemptionAmount = glpBal.mul(USDC_REDEMPTION_AMOUNT).div(GLP_SUPPLIED_AMOUNT);
          usedRewardAmount = usedRewardAmount.add(usdcRedemptionAmount);

          // set usdc redemption amount and redeem
          const outputMarketId = glpBal.lte(parseEther('.02')) ? core.marketIds.link : core.marketIds.wbtc;
          try {
            await redemptionOperator.connect(core.hhUser4).handlerSetUsdcRedemptionAmounts(
              [vaultAddress],
              [marginAccount.accountNumber],
              [usdcRedemptionAmount]
            );
            await redemptionOperator.connect(core.hhUser4).handlerRedeemGLP(
              vaultAddress,
              marginAccount.accountNumber,
              outputMarketId,
              ONE_BI // @todo update
            );
          } catch (error) {
            console.log('Error redeeming GLP for user: ', user['address']);
            console.log(error);
            badUsers.push(user['address']);
            continue;
          }
        }

        // handle default account
        const defaultRewardAmount = fullRewardAmount.sub(usedRewardAmount);
        const outputMarketId = defaultAccountBal.lte(parseEther('.02')) ? core.marketIds.link : core.marketIds.wbtc;
        await redemptionOperator.connect(core.hhUser4).handlerSetUsdcRedemptionAmounts(
          [vaultAddress],
          [defaultAccountNumber],
          [defaultRewardAmount]
        );
        await redemptionOperator.connect(core.hhUser4).handlerRedeemGLP(
          vaultAddress,
          defaultAccountNumber,
          outputMarketId,
          ONE_BI // @todo update
        );
      }
      console.log('Bad users: ', badUsers);
    });
  });
});
