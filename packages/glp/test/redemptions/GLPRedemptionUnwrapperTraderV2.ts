import { GenericEventEmissionType, GenericTraderParam, GenericTraderType } from "@dolomite-margin/dist/src/modules/GenericTraderProxyV1";
import { BalanceCheckFlag } from "@dolomite-margin/dist/src/types";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { defaultAbiCoder, parseEther } from "ethers/lib/utils";
import { GMX_GOV_MAP } from "packages/base/src/utils/constants";
import { createContractWithAbi, createContractWithLibrary, createContractWithName } from "packages/base/src/utils/dolomite-utils";
import { ADDRESS_ZERO, Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from "packages/base/src/utils/no-deps-constants";
import { SignerWithAddressWithSafety } from "packages/base/src/utils/SignerWithAddressWithSafety";
import { impersonate, revertToSnapshotAndCapture, snapshot, waitDays } from "packages/base/test/utils";
import { expectEvent, expectProtocolBalance, expectProtocolBalanceIsGreaterThan, expectThrow, expectWalletBalance } from "packages/base/test/utils/assertions";
import { CoreProtocolArbitrumOne } from "packages/base/test/utils/core-protocols/core-protocol-arbitrum-one";
import { setupCoreProtocol, setupGMXBalance, setupUserVaultProxy } from "packages/base/test/utils/setup";
import { GLPIsolationModeMigrator, GLPIsolationModeMigrator__factory, GLPMathLib, GLPMathLib__factory, GLPRedemptionUnwrapperTraderV2, GLPRedemptionUnwrapperTraderV2__factory, GMXIsolationModeTokenVaultV1, GMXIsolationModeTokenVaultV1__factory, IGLPIsolationModeVaultFactoryOld, IGMXIsolationModeVaultFactory } from "packages/glp/src/types";

const gmxAmount = BigNumber.from('10000000000000000000'); // 10 GMX
const usdcAmount = BigNumber.from('2000000000'); // 2,000 USDC
const amountWei = BigNumber.from('1250000000000000000000'); // 1,250 GLP tokens

const esGmxAmount = BigNumber.from('10000000000000000'); // 0.01 esGMX tokens

const userAddress = '0xae7ae37d9D97ABc1099995036f17701fd55cefE5';
const glpVaultAddress = '0x121228cBAF3f3615b5b99F6B41bED5e536f8C19a'; // user with rougly 16 GLP. 14 in 0, 2.8 ish in borrow account
const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = BigNumber.from('64870034939730665364032064862425947019883560685074554993543589166029552275672');
const defaultBalance = BigNumber.from('13999537919923944484');
const borrowBalance = BigNumber.from('2809995446140322474');

describe('GLPRedemptionUnwrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let glpFactory: IGLPIsolationModeVaultFactoryOld;
  let gmxFactory: IGMXIsolationModeVaultFactory;
  let unwrapper: GLPRedemptionUnwrapperTraderV2;
  
  let user: SignerWithAddressWithSafety;
  let glpVault: GLPIsolationModeMigrator;
  let gmxVault: GMXIsolationModeTokenVaultV1;
  let gmxVaultImpersonator: SignerWithAddressWithSafety;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 369_756_000,
      network: Network.ArbitrumOne,
    });

    glpFactory = core.gmxEcosystem.live.dGlp;
    gmxFactory = core.gmxEcosystem.live.dGmx;

    const glpLib = await createContractWithName('GLPActionsLib', []);
    const migratorImplementation = await createContractWithLibrary<GLPIsolationModeMigrator>(
      'GLPIsolationModeMigrator',
      { GLPActionsLib: glpLib.address },
      [core.hhUser4.address, core.tokens.usdc.address]
    );
    await core.gmxEcosystem.live.dGlp.connect(core.governance).setUserVaultImplementation(migratorImplementation.address);

    unwrapper = await createContractWithAbi<GLPRedemptionUnwrapperTraderV2>(
      GLPRedemptionUnwrapperTraderV2__factory.abi,
      GLPRedemptionUnwrapperTraderV2__factory.bytecode,
      [
        core.gmxEcosystem.live.gmxRegistry.address,
        core.hhUser4.address,
        core.tokens.usdc.address,
        core.tokens.dfsGlp.address,
        core.dolomiteMargin.address
      ]
    );
    await core.gmxEcosystem.live.dGlp.connect(core.governance).setIsTokenConverterTrusted(unwrapper.address, true);

    user = await impersonate(userAddress);
    glpVault = GLPIsolationModeMigrator__factory.connect(
      glpVaultAddress,
      user
    );

    await setupGMXBalance(core, user, gmxAmount, core.depositWithdrawalRouter);
    await core.depositWithdrawalRouter.connect(user).depositWei(
      core.marketIds.dGmx,
      defaultAccountNumber,
      core.marketIds.dGmx,
      gmxAmount,
      0
    );
    gmxVault = GMXIsolationModeTokenVaultV1__factory.connect(
      await gmxFactory.connect(core.governance).getVaultByAccount(user.address),
      user
    );
    gmxVaultImpersonator = await impersonate(gmxVault.address, true);
    await expectProtocolBalance(core, gmxVault, defaultAccountNumber, core.marketIds.dGmx, gmxAmount);

    await core.gmxEcosystem.esGmxDistributorForStakedGmx.setTokensPerInterval('10333994708994708');
    const gov = await impersonate(GMX_GOV_MAP[Network.ArbitrumOne]!, true);
    await core
      .gmxEcosystem!.esGmx.connect(gov)
      .mint(core.gmxEcosystem.esGmxDistributorForStakedGmx.address, parseEther('100000000'));


    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await unwrapper.GMX_REGISTRY()).to.eq(core.gmxEcosystem.live.gmxRegistry.address);
      expect(await unwrapper.HANDLER()).to.eq(core.hhUser4.address);
      expect(await unwrapper.USDC()).to.eq(core.tokens.usdc.address);
    });
  });

  describe('#handlerSetUsdcRedemptionAmounts', () => {
    it('should work normally', async () => {
      const res = await unwrapper.connect(core.hhUser4).handlerSetUsdcRedemptionAmounts(
        [user.address],
        [defaultAccountNumber],
        [usdcAmount]
      );
      await expectEvent(unwrapper, res, 'UsdcRedemptionAmountSet', {
        user: user.address,
        accountNumber: defaultAccountNumber,
        usdcRedemptionAmount: usdcAmount
      });
    });

    it('should fail if invalid array lengths', async () => {
      await expectThrow(
        unwrapper.connect(core.hhUser4).handlerSetUsdcRedemptionAmounts(
          [user.address],
          [defaultAccountNumber, defaultAccountNumber],
          [usdcAmount]
        ),
        'GLPRedemptionUnwrapperTraderV2: Invalid input lengths'
      );
      await expectThrow(
        unwrapper.connect(core.hhUser4).handlerSetUsdcRedemptionAmounts(
          [user.address, user.address],
          [defaultAccountNumber, defaultAccountNumber],
          [usdcAmount]
        ),
        'GLPRedemptionUnwrapperTraderV2: Invalid input lengths'
      );
    });

    it('should fail if not called by handler', async () => {
      await expectThrow(
        unwrapper.connect(user).handlerSetUsdcRedemptionAmounts(
          [user.address],
          [defaultAccountNumber],
          [usdcAmount]
        ),
        'GLPRedemptionUnwrapperTraderV2: Only handler can call'
      );
    });
  });

  describe('#isValidOutputToken', () => {
    it('should work normally', async () => {
      expect(await unwrapper.isValidOutputToken(core.tokens.usdc.address)).to.eq(true);

      expect(await unwrapper.isValidOutputToken(core.tokens.dfsGlp.address)).to.eq(false);
      expect(await unwrapper.isValidOutputToken(core.tokens.weth.address)).to.eq(false);
    });
  });
});
