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
import { expectProtocolBalance, expectProtocolBalanceIsGreaterThan, expectThrow, expectWalletBalance } from "packages/base/test/utils/assertions";
import { CoreProtocolArbitrumOne } from "packages/base/test/utils/core-protocols/core-protocol-arbitrum-one";
import { createIsolationModeTokenVaultV1ActionsImpl } from "packages/base/test/utils/dolomite";
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

describe('GLPIsolationModeMigrator', () => {
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
      expect(await glpVault.HANDLER()).to.eq(core.hhUser4.address);
      expect(await glpVault.OWNER()).to.eq(user.address);
      expect(await glpVault.VAULT_FACTORY()).to.eq(glpFactory.address);
      expect(await glpVault.USDC()).to.eq(core.tokens.usdc.address);
    });
  });

  xdescribe('#handlerUnwrapGLP', () => {
    it('should work normally with default account', async () => {
      const traderParam: GenericTraderParam = {
        trader: unwrapper.address,
        traderType: GenericTraderType.IsolationModeUnwrapper,
        tradeData: defaultAbiCoder.encode(
          ['uint256', 'bytes'],
          [ONE_BI, defaultAbiCoder.encode(['address', 'uint256'], [glpVaultAddress, defaultAccountNumber])],
        ),
        makerAccountIndex: 0,
      };

      await glpVault.connect(core.hhUser4).handlerUnwrapGLP(
        defaultAccountNumber,
        [core.marketIds.dfsGlp, core.marketIds.usdc],
        defaultBalance,
        ONE_BI,
        [traderParam],
        [],
        {
          deadline: '123123123123123',
          balanceCheckFlag: BalanceCheckFlag.None,
          eventType: GenericEventEmissionType.None,
        }
      )
    });

    it('should work normally with borrow account', async () => {
    });

    it('should fail if not called by handler', async () => {
      await expectThrow(
        glpVault.connect(core.hhUser1).handlerUnwrapGLP(
          defaultAccountNumber,
          [core.marketIds.dfsGlp, core.marketIds.usdc],
          defaultBalance,
          ONE_BI,
          [],
          [],
          {
            deadline: '123123123123123',
            balanceCheckFlag: BalanceCheckFlag.None,
            eventType: GenericEventEmissionType.None,
          }
        ),
        'GLPIsolationModeMigrator: Only handler can call'
      );
    });
  });

  describe('#handleRewards', () => {
    it('should work normally', async () => {
      expect(await core.tokens.weth.balanceOf(user.address)).to.eq(ZERO_BI);
      await glpVault.connect(user).handleRewards(
        true,
        true,
        true,
        true,
        true,
        true,
        false,
      );
      expect(await core.tokens.weth.balanceOf(user.address)).to.gt(ZERO_BI);
    });

    it.only('should fail if not called by vault owner', async () => {
      await expectThrow(
        glpVault.connect(core.hhUser1).handleRewards(
          true,
          true,
          true,
          true,
          true,
          true,
          false,
        ),
        'GLPIsolationModeMigrator: Only vault owner can call'
      );
    });
  });

  describe('#handleRewardsWithSpecificDepositAccountNumber', () => {
    it('should work normally', async () => {
      expect(await core.tokens.weth.balanceOf(user.address)).to.eq(ZERO_BI);
      await glpVault.connect(user).handleRewardsWithSpecificDepositAccountNumber(
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        10
      );
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: user.address, number: 10},
        core.marketIds.weth,
        ONE_BI,
        ZERO_BI,
      );
    });
  });

  describe('#stakeEsGmx', () => {
    it('should work normally', async () => {
      await glpVault.connect(user).handleRewards(
        true,
        false,
        true,
        false,
        false,
        false,
        false,
      );
      const originalBalance = await core.gmxEcosystem.esGmx.balanceOf(glpVault.address);
      await glpVault.connect(user).stakeEsGmx(esGmxAmount);
      expect(await glpVault.esGmxBalanceOf()).to.eq(originalBalance);
      expect(await core.gmxEcosystem.esGmx.balanceOf(glpVault.address)).to.eq(originalBalance.sub(esGmxAmount));
    });
  });

  describe('#unstakeEsGmx', () => {
    it('should work normally', async () => {
      await glpVault.connect(user).handleRewards(
        true,
        false,
        true,
        false,
        false,
        false,
        false,
      );
      const originalBalance = await core.gmxEcosystem.esGmx.balanceOf(glpVault.address);

      await glpVault.connect(user).stakeEsGmx(esGmxAmount);
      expect(await glpVault.esGmxBalanceOf()).to.eq(originalBalance);
      expect(await core.gmxEcosystem.esGmx.balanceOf(glpVault.address)).to.eq(originalBalance.sub(esGmxAmount));

      await glpVault.connect(user).unstakeEsGmx(esGmxAmount);
      expect(await glpVault.esGmxBalanceOf()).to.eq(originalBalance);
    });
  });

  describe('#unvestGlp', () => {
    it('should work normally', async () => {
    });
  });

  describe('#stakeGmx', () => {
    it('should work normally', async () => {
      await gmxVault.connect(user).unstakeGmx(gmxAmount);
      expect(await core.tokens.gmx.balanceOf(gmxVault.address)).to.eq(gmxAmount);

      await gmxVault.connect(user).stakeGmx(gmxAmount);
      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);
      expect(await core.gmxEcosystem.sbfGmx.balanceOf(glpVault.address)).to.eq(gmxAmount);
      await expectProtocolBalance(core, gmxVault.address, defaultAccountNumber, core.marketIds.dGmx, gmxAmount);
      await expectWalletBalance(gmxVault.address, core.tokens.gmx, ZERO_BI);
    });

    it('should fail if vault is frozen', async () => {
      await gmxVault.connect(user).requestAccountTransfer(user.address); // freeze the vault
      await expectThrow(
        gmxVault.connect(user).stakeGmx(gmxAmount),
        'GLPIsolationModeMigrator: Vault is frozen'
      );
    });

    it('should fail if not gmx vault', async () => {
      await expectThrow(
        glpVault.connect(user).stakeGmx(gmxAmount),
        'GLPIsolationModeMigrator: Invalid GMX vault'
      );
    });
  });

  describe('#unstakeGmx', () => {
    it('should work normally', async () => {
      await gmxVault.connect(user).unstakeGmx(gmxAmount);

      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem.sbfGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, gmxVault.address, defaultAccountNumber, core.marketIds.dGmx, gmxAmount);
      await expectWalletBalance(gmxVault.address, core.tokens.gmx, gmxAmount);
    });

    it('should fail if vault is frozen', async () => {
      await gmxVault.connect(user).requestAccountTransfer(user.address); // freeze the vault
      await expectThrow(
        gmxVault.connect(user).unstakeGmx(gmxAmount),
        'GLPIsolationModeMigrator: Vault is frozen'
      );
    });

    it('should fail if not gmx vault', async () => {
      await expectThrow(
        glpVault.connect(user).unstakeGmx(gmxAmount),
        'GLPIsolationModeMigrator: Invalid GMX vault'
      );
    });
  });

  describe('#vestGmx', () => {
    it('should work normally', async () => {
      await glpVault.connect(user).handleRewards(
        true,
        false,
        true,
        false,
        false,
        false,
        false,
      );
      const gmxAmountVested = await glpVault.getGmxAmountNeededForEsGmxVesting(esGmxAmount);
      await gmxVault.connect(user).vestGmx(esGmxAmount);
      expect(await core.gmxEcosystem.vGmx.pairAmounts(glpVault.address)).to.eq(gmxAmountVested);
      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);
      await expectProtocolBalance(core, gmxVault.address, defaultAccountNumber, core.marketIds.dGmx, gmxAmount);
    });

    it('should fail if vault is frozen', async () => {
      await gmxVault.connect(user).requestAccountTransfer(user.address); // freeze the vault
      await expectThrow(
        glpVault.connect(user).vestGmx(esGmxAmount),
        'GLPIsolationModeMigrator: Vault is frozen'
      );
    });

    it('should fail if not called by gmx vault', async () => {
      await expectThrow(
        glpVault.connect(user).vestGmx(esGmxAmount),
        'GLPIsolationModeMigrator: Invalid GMX vault'
      );
    });
  });

  describe('#unvestGmx', () => {
    it('should work normally', async () => {
      await glpVault.connect(user).handleRewards(
        true,
        false,
        true,
        false,
        false,
        false,
        false,
      );
      const gmxAmountVested = await glpVault.getGmxAmountNeededForEsGmxVesting(esGmxAmount);
      await gmxVault.connect(user).vestGmx(esGmxAmount);
      expect(await core.gmxEcosystem.vGmx.pairAmounts(glpVault.address)).to.eq(gmxAmountVested);
      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);
      await expectProtocolBalance(core, gmxVault.address, defaultAccountNumber, core.marketIds.dGmx, gmxAmount);

      await gmxVault.connect(user).unvestGmx(false);
    });

    it('should fail if vault is frozen', async () => {
      await gmxVault.connect(user).requestAccountTransfer(user.address); // freeze the vault
      await expectThrow(
        glpVault.connect(gmxVaultImpersonator).unvestGmx(false, true),
        'GLPIsolationModeMigrator: Vault is frozen'
      );
    });

    it('should fail if not called by gmx vault', async () => {
      await expectThrow(
        glpVault.connect(user).unvestGmx(false, true),
        'GLPIsolationModeMigrator: Invalid GMX vault'
      );
    });
  });

  describe('#sweepGmxTokensIntoGmxVault', () => {
    it('should work normally', async () => {
      await setupGMXBalance(core, core.hhUser1, ONE_ETH_BI, core.hhUser1)
      await core.tokens.gmx.connect(core.hhUser1).transfer(glpVault.address, ONE_ETH_BI);
      await glpVault.connect(gmxVaultImpersonator).sweepGmxTokensIntoGmxVault();

      await expectProtocolBalance(core, gmxVault.address, defaultAccountNumber, core.marketIds.dGmx, gmxAmount.add(ONE_ETH_BI));
    });
  });

  describe('#sync', () => {
    it('should fail if already synced', async () => {
      await gmxFactory.connect(core.hhUser1).createVault(core.hhUser1.address);
      const gmxVault = setupUserVaultProxy<GMXIsolationModeTokenVaultV1>(
        await gmxFactory.getVaultByAccount(core.hhUser1.address),
        GMXIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );

      const factoryImpersonator = await impersonate(gmxFactory.address, true);
      await expectThrow(
        glpVault.connect(factoryImpersonator).sync(gmxVault.address),
        'GLPIsolationModeMigrator: Already synced',
      );
    });

    it('should fail when not called by gmx glpVault factory', async () => {
      await expectThrow(
        glpVault.connect(core.hhUser1).sync(core.hhUser1.address),
        `GLPIsolationModeMigrator: Only GMX factory can sync <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when vault is frozen', async () => {
      await gmxVault.connect(user).requestAccountTransfer(user.address); // freeze the vault
      await expectThrow(
        glpVault.sync(ADDRESS_ZERO),
        'GLPIsolationModeMigrator: Vault is frozen'
      );
    });
  });

  describe('#executeWithdrawalFromVault', () => {
    it('should fail if not called by glp factory', async () => {
      await expectThrow(
        glpVault.connect(user).executeWithdrawalFromVault(user.address, ONE_ETH_BI),
        'GLPIsolationModeMigrator: Only vault factory can call'
      );
    });
  });
});
