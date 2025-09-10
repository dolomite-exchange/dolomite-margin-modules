import { BigNumber } from 'ethers';
import { createContractWithAbi, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { Network, ONE_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { impersonate, revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectProtocolBalance } from 'packages/base/test/utils/assertions';
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

const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = BigNumber.from('64870034939730665364032064862425947019883560685074554993543589166029552275672');
const defaultOutputWbtc = BigNumber.from('1297');
const borrowOutputWbtc = BigNumber.from('259');

const glpUnwrapperTraderAddress = '0xaacDc43568f9adC4D3b67a26BD04159Ded39D79d';

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
    });
  });

  describe('#handlerRedeemGLP', () => {
    it('should work normally to unwrap GLP with no USDC reward in default account', async () => {
      await redemptionOperator.connect(core.hhUser4).handlerRedeemGLP(
        glpVault.address,
        defaultAccountNumber,
        core.marketIds.wbtc,
        ONE_BI
      );

      await expectProtocolBalance(core, glpVault, defaultAccountNumber, core.marketIds.dfsGlp, ZERO_BI);
      await expectProtocolBalance(core, user, defaultAccountNumber, core.marketIds.wbtc, defaultOutputWbtc);
    });

    it('should work normally to unwrap GLP with USDC reward in default account', async () => {
      const currentUsdcBal = (await core.dolomiteMargin.getAccountWei(
        { owner: user.address, number: defaultAccountNumber },
        core.marketIds.usdc
      )).value;
      const usdcReward = BigNumber.from('15000000'); // 15 USDC
      await redemptionOperator.connect(core.governance).ownerSetRedemptionAmount(
        [glpVault.address],
        [defaultAccountNumber],
        [usdcReward] // 15 USDC
      );

      await redemptionOperator.connect(core.hhUser4).handlerRedeemGLP(
        glpVault.address,
        defaultAccountNumber,
        core.marketIds.wbtc,
        ONE_BI
      );

      await expectProtocolBalance(core, glpVault, defaultAccountNumber, core.marketIds.dfsGlp, ZERO_BI);
      await expectProtocolBalance(
        core,
        user,
        defaultAccountNumber,
        core.marketIds.usdc,
        currentUsdcBal.add(usdcReward)
      );
      await expectProtocolBalance(core, user, defaultAccountNumber, core.marketIds.wbtc, defaultOutputWbtc);
    });

    it('should work normally to unwrap GLP with USDC reward in borrow account', async () => {
      const usdcReward = BigNumber.from('15000000'); // 15 USDC
      await redemptionOperator.connect(core.governance).ownerSetRedemptionAmount(
        [glpVault.address],
        [borrowAccountNumber],
        [usdcReward] // 15 USDC
      );

      await redemptionOperator.connect(core.hhUser4).handlerRedeemGLP(
        glpVault.address,
        borrowAccountNumber,
        core.marketIds.wbtc,
        ONE_BI
      );

      await expectProtocolBalance(core, glpVault, borrowAccountNumber, core.marketIds.dfsGlp, ZERO_BI);
      await expectProtocolBalance(core, glpVault, borrowAccountNumber, core.marketIds.usdc, usdcReward);
      await expectProtocolBalance(core, glpVault, borrowAccountNumber, core.marketIds.wbtc, borrowOutputWbtc);

      // Make sure user can now close borrow position
      const currentUsdcBal = (await core.dolomiteMargin.getAccountWei(
        { owner: user.address, number: defaultAccountNumber },
        core.marketIds.usdc
      )).value;
      const currentWbtcBal = (await core.dolomiteMargin.getAccountWei(
        { owner: user.address, number: defaultAccountNumber },
        core.marketIds.wbtc
      )).value;
      await glpVault.connect(user).closeBorrowPositionWithOtherTokens(
        borrowAccountNumber,
        defaultAccountNumber,
        [core.marketIds.usdc, core.marketIds.wbtc]
      );
      await expectProtocolBalance(core, glpVault, borrowAccountNumber, core.marketIds.usdc, ZERO_BI);
      await expectProtocolBalance(core, glpVault, borrowAccountNumber, core.marketIds.wbtc, ZERO_BI);
      await expectProtocolBalance(
        core,
        user,
        defaultAccountNumber,
        core.marketIds.usdc,
        currentUsdcBal.add(usdcReward)
      );
      await expectProtocolBalance(
        core,
        user,
        defaultAccountNumber,
        core.marketIds.wbtc,
        currentWbtcBal.add(borrowOutputWbtc)
      );
    });
  });
});
