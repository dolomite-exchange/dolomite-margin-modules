import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { createContractWithAbi, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { Network, ONE_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { impersonate, revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectProtocolBalance, expectProtocolWeiBalanceChange, expectThrow } from 'packages/base/test/utils/assertions';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { disableInterestAccrual, setupCoreProtocol, setupUSDCBalance } from 'packages/base/test/utils/setup';
import {
  GLPIsolationModeTokenVaultV3Paused,
  GLPIsolationModeTokenVaultV3Paused__factory,
  GLPRedemptionOperator,
  GLPRedemptionOperator__factory,
} from 'packages/glp/src/types';

const totalUsdcRewardAmount = BigNumber.from('10000000000'); // 10,000 USDC

const userAddress = '0xae7ae37d9D97ABc1099995036f17701fd55cefE5';
const glpVaultAddress = '0x121228cBAF3f3615b5b99F6B41bED5e536f8C19a'; // roughly 14 GLP in 0, 2.8 ish in borrow account

const userAddress2 = '0x50A852203b68861968786fA057b0716860775b3a';
const glpVaultAddress2 = '0x47D746940fC01aA4CF6C6107DE9B6b8E05E53795';

const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = BigNumber.from('64870034939730665364032064862425947019883560685074554993543589166029552275672');

const defaultOutputWbtc = BigNumber.from('1297');
const borrowOutputWbtc = BigNumber.from('259');

const glpUnwrapperTraderAddress = '0xaacDc43568f9adC4D3b67a26BD04159Ded39D79d';

const usdcReward = BigNumber.from('15000000');

describe('GLPRedemptionOperator', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let redemptionOperator: GLPRedemptionOperator;

  let user: SignerWithAddressWithSafety;
  let glpVault: GLPIsolationModeTokenVaultV3Paused;

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
        core.marketIds.usdc,
        core.gmxEcosystem.live.dGlp.address,
        glpUnwrapperTraderAddress,
        core.dolomiteMargin.address
      ]
    );

    user = await impersonate(userAddress);
    glpVault = GLPIsolationModeTokenVaultV3Paused__factory.connect(
      glpVaultAddress,
      user
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

    await setupUSDCBalance(core, core.hhUser5, totalUsdcRewardAmount, core.dolomiteMargin);
    await depositIntoDolomiteMargin(
      core,
      core.hhUser5,
      defaultAccountNumber,
      core.marketIds.usdc,
      totalUsdcRewardAmount
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await redemptionOperator.HANDLER()).to.eq(core.hhUser4.address);
      expect(await redemptionOperator.USDC_FUND()).to.eq(core.hhUser5.address);
      expect(await redemptionOperator.USDC_MARKET_ID()).to.eq(core.marketIds.usdc);
      expect(await redemptionOperator.GLP_FACTORY()).to.eq(core.gmxEcosystem.live.dGlp.address);
      expect(await redemptionOperator.GLP_UNWRAPPER_TRADER()).to.eq(glpUnwrapperTraderAddress);
      expect(await redemptionOperator.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });
  });

  describe('#handlerSetRedemptionAmounts', () => {
    it('should work normally', async () => {
      const res = await redemptionOperator.connect(core.hhUser4).handlerSetRedemptionAmounts(
        [
          {
            vault: glpVault.address,
            accountNumbers: [defaultAccountNumber, borrowAccountNumber],
            usdcRedemptionAmounts: [usdcReward, usdcReward]
          },
        ]
      );
      await expectEvent(redemptionOperator, res, 'UsdcRedemptionAmountSet', {
        vault: glpVault.address,
        accountNumbers: [defaultAccountNumber, borrowAccountNumber],
        usdcRedemptionAmounts: [usdcReward, usdcReward]
      });

      expect(await redemptionOperator.usdcRedemptionAmount(glpVault.address, defaultAccountNumber)).to.eq(usdcReward);
    });

    it('should fail if not called by handler', async () => {
      await expectThrow(
        redemptionOperator.connect(core.hhUser1).handlerSetRedemptionAmounts(
          [
            {
              vault: glpVault.address,
              accountNumbers: [defaultAccountNumber],
              usdcRedemptionAmounts: [usdcReward]
            }
          ]
        ),
        'GLPRedemptionOperator: Only handler can call'
      );
    });

    it('should fail if invalid array lengths', async () => {
      await expectThrow(
        redemptionOperator.connect(core.hhUser4).handlerSetRedemptionAmounts(
          [
            {
              vault: glpVault.address,
              accountNumbers: [defaultAccountNumber, borrowAccountNumber],
              usdcRedemptionAmounts: [usdcReward]
            },
          ]
        ),
        'GLPRedemptionOperator: Invalid input lengths'
      );
    });
  });

  describe('#handlerRedeemGLP', () => {
    it('should work normally to unwrap GLP in default account', async () => {
      await redemptionOperator.connect(core.hhUser4).handlerSetRedemptionAmounts(
        [
          {
            vault: glpVault.address,
            accountNumbers: [defaultAccountNumber],
            usdcRedemptionAmounts: [usdcReward]
          }
        ]
      );

      const tx = await redemptionOperator.connect(core.hhUser4).handlerExecuteVault(
        glpVault.address,
        [
          { accountNumber: defaultAccountNumber, outputMarketId: core.marketIds.wbtc, minOutputAmountWei: ONE_BI }
        ]
      );

      await expectProtocolBalance(core, glpVault, defaultAccountNumber, core.marketIds.dfsGlp, ZERO_BI);
      await expectProtocolWeiBalanceChange(
        core,
        tx,
        user,
        defaultAccountNumber,
        core.marketIds.wbtc,
        defaultOutputWbtc
      );
      await expectProtocolWeiBalanceChange(core, tx, user, defaultAccountNumber, core.marketIds.usdc, usdcReward);
    });

    it('should work normally if no GLP in default account', async () => {
      await redemptionOperator.connect(core.hhUser4).handlerSetRedemptionAmounts(
        [
          {
            vault: glpVaultAddress2,
            accountNumbers: [defaultAccountNumber],
            usdcRedemptionAmounts: [usdcReward] // 15 USDC
          }
        ]
      );

      const tx = await redemptionOperator.connect(core.hhUser4).handlerExecuteVault(
        glpVaultAddress2,
        [
          { accountNumber: defaultAccountNumber, outputMarketId: core.marketIds.wbtc, minOutputAmountWei: ONE_BI }
        ]
      );
      await expectProtocolBalance(core, glpVaultAddress2, defaultAccountNumber, core.marketIds.dfsGlp, ZERO_BI);
      await expectProtocolBalance(core, glpVaultAddress2, defaultAccountNumber, core.marketIds.wbtc, ZERO_BI);
      await expectProtocolWeiBalanceChange(
        core,
        tx,
        userAddress2,
        defaultAccountNumber,
        core.marketIds.usdc,
        usdcReward
      );
    });

    it('should work normally to unwrap GLP with USDC reward in borrow account', async () => {
      await redemptionOperator.connect(core.hhUser4).handlerSetRedemptionAmounts(
        [
          {
            vault: glpVault.address,
            accountNumbers: [borrowAccountNumber],
            usdcRedemptionAmounts: [usdcReward] // 15 USDC
          }
        ]
      );

      const tx = await redemptionOperator.connect(core.hhUser4).handlerExecuteVault(
        glpVault.address,
        [
          { accountNumber: borrowAccountNumber, outputMarketId: core.marketIds.wbtc, minOutputAmountWei: ONE_BI }
        ]
      );

      await expectProtocolBalance(core, glpVault, borrowAccountNumber, core.marketIds.dfsGlp, ZERO_BI);
      await expectProtocolWeiBalanceChange(
        core,
        tx,
        glpVault,
        borrowAccountNumber,
        core.marketIds.usdc,
        usdcReward
      );
      await expectProtocolWeiBalanceChange(
        core,
        tx,
        glpVault,
        borrowAccountNumber,
        core.marketIds.wbtc,
        borrowOutputWbtc
      );

      // Make sure user can now close borrow position
      const tx2 = await glpVault.connect(user).closeBorrowPositionWithOtherTokens(
        borrowAccountNumber,
        defaultAccountNumber,
        [core.marketIds.usdc, core.marketIds.wbtc]
      );
      await expectProtocolBalance(core, glpVault, borrowAccountNumber, core.marketIds.usdc, ZERO_BI);
      await expectProtocolBalance(core, glpVault, borrowAccountNumber, core.marketIds.wbtc, ZERO_BI);
      await expectProtocolWeiBalanceChange(
        core,
        tx2,
        user,
        defaultAccountNumber,
        core.marketIds.usdc,
        usdcReward
      );
      await expectProtocolWeiBalanceChange(
        core,
        tx2,
        user,
        defaultAccountNumber,
        core.marketIds.wbtc,
        borrowOutputWbtc
      );
    });

    it('should work normally to unwrap GLP with USDC reward in both accounts', async () => {
      await redemptionOperator.connect(core.hhUser4).handlerSetRedemptionAmounts(
        [
          {
            vault: glpVault.address,
            accountNumbers: [defaultAccountNumber, borrowAccountNumber],
            usdcRedemptionAmounts: [usdcReward, usdcReward]
          }
        ]
      );

      const tx = await redemptionOperator.connect(core.hhUser4).handlerExecuteVault(
        glpVault.address,
        [
          { accountNumber: defaultAccountNumber, outputMarketId: core.marketIds.wbtc, minOutputAmountWei: ONE_BI },
          { accountNumber: borrowAccountNumber, outputMarketId: core.marketIds.wbtc, minOutputAmountWei: ONE_BI },
        ]
      );

      expect(await redemptionOperator.usdcRedemptionAmount(glpVault.address, defaultAccountNumber)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, glpVault, defaultAccountNumber, core.marketIds.dfsGlp, ZERO_BI);
      await expectProtocolWeiBalanceChange(
        core,
        tx,
        user,
        defaultAccountNumber,
        core.marketIds.wbtc,
        defaultOutputWbtc
      );
      await expectProtocolWeiBalanceChange(
        core,
        tx,
        user,
        defaultAccountNumber,
        core.marketIds.usdc,
        usdcReward
      );

      expect(await redemptionOperator.usdcRedemptionAmount(glpVault.address, borrowAccountNumber)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, glpVault, borrowAccountNumber, core.marketIds.dfsGlp, ZERO_BI);
      await expectProtocolWeiBalanceChange(
        core,
        tx,
        glpVault,
        borrowAccountNumber,
        core.marketIds.usdc,
        usdcReward
      );
      await expectProtocolWeiBalanceChange(
        core,
        tx,
        glpVault,
        borrowAccountNumber,
        core.marketIds.wbtc,
        borrowOutputWbtc
      );
    });

    it('should fail if invalid GLP vault', async () => {
      await expectThrow(
        redemptionOperator.connect(core.hhUser4).handlerExecuteVault(
          core.hhUser1.address,
          [
            { accountNumber: defaultAccountNumber, outputMarketId: core.marketIds.wbtc, minOutputAmountWei: ONE_BI }
          ]
        ),
      );
    });

    it('should fail if not called by handler', async () => {
      await expectThrow(
        redemptionOperator.connect(core.hhUser1).handlerExecuteVault(
          glpVault.address,
          [
            { accountNumber: defaultAccountNumber, outputMarketId: core.marketIds.wbtc, minOutputAmountWei: ONE_BI }
          ]
        ),
        'GLPRedemptionOperator: Only handler can call'
      );
    });
  });
});
