import { MAX_UINT_256_BI, Network, ONE_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectThrow,
  expectWalletBalance,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupGMXBalance,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber, ContractTransaction } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  GLPIsolationModeTokenVaultV2__factory,
  GLPIsolationModeVaultFactory,
  GMXIsolationModeTokenVaultV1,
  GMXIsolationModeTokenVaultV1__factory,
  GMXIsolationModeVaultFactory,
  GmxRegistryV1,
  IsolationModeUpgradeableProxy,
  IsolationModeUpgradeableProxy__factory,
} from '../src/types';
import {
  createGLPIsolationModeTokenVaultV1,
  createGLPIsolationModeTokenVaultV2,
  createGLPIsolationModeVaultFactory,
  createGMXIsolationModeTokenVaultV1,
  createGMXIsolationModeVaultFactory,
  createGmxRegistry,
} from './glp-ecosystem-utils';

const gmxAmount = parseEther('10');
const toAccountNumber = '0';
const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const usdcAmount = BigNumber.from('2000000000'); // 2,000 USDC

describe('GMXIsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let gmxRegistry: GmxRegistryV1;
  let vaultImplementation: GMXIsolationModeTokenVaultV1;
  let gmxFactory: GMXIsolationModeVaultFactory;
  let glpFactory: GLPIsolationModeVaultFactory;
  let glpAmount: BigNumber;
  let underlyingMarketIdGmx: BigNumber;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));

    gmxRegistry = await createGmxRegistry(core);
    const glpVaultImplementation = await createGLPIsolationModeTokenVaultV2();
    glpFactory = await createGLPIsolationModeVaultFactory(core, gmxRegistry, glpVaultImplementation);
    vaultImplementation = await createGMXIsolationModeTokenVaultV1();
    gmxFactory = await createGMXIsolationModeVaultFactory(core, gmxRegistry, vaultImplementation);

    await core.testEcosystem!.testPriceOracle.setPrice(glpFactory.address, '1000000000000000000');
    await setupTestMarket(core, glpFactory, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(glpFactory.address, true);
    await glpFactory.connect(core.governance).ownerInitialize([]);

    underlyingMarketIdGmx = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(gmxFactory.address, '1000000000000000000');
    await setupTestMarket(core, gmxFactory, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(gmxFactory.address, true);
    await gmxFactory.connect(core.governance).ownerInitialize([]);

    await gmxRegistry.connect(core.governance).ownerSetGlpVaultFactory(glpFactory.address);
    await gmxRegistry.connect(core.governance).ownerSetGmxVaultFactory(gmxFactory.address);

    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
    await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1).mintAndStakeGlp(
      core.tokens.usdc.address,
      usdcAmount,
      ONE_BI,
      ONE_BI,
    );
    // use sGLP for approvals/transfers and fsGLP for checking balances
    glpAmount = await core.gmxEcosystem!.fsGlp.connect(core.hhUser1).balanceOf(core.hhUser1.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  async function checkVaultCreationResults(result: ContractTransaction) {
    const vault = await gmxFactory.getVaultByAccount(core.hhUser1.address);
    const account = await gmxFactory.getAccountByVault(vault);
    expect(account).to.eq(core.hhUser1.address);
    await expectEvent(gmxFactory, result, 'VaultCreated', {
      account: core.hhUser1.address,
      vault: vault.toString(),
    });
    expect(await core.borrowPositionProxyV2.isCallerAuthorized(vault)).to.eq(true);

    const vaultContract = setupUserVaultProxy<IsolationModeUpgradeableProxy>(
      vault,
      IsolationModeUpgradeableProxy__factory,
      core.hhUser1,
    );
    expect(await vaultContract.isInitialized()).to.eq(true);
    expect(await vaultContract.owner()).to.eq(core.hhUser1.address);
  }

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await gmxFactory.gmxRegistry()).to.equal(gmxRegistry.address);
      expect(await gmxFactory.UNDERLYING_TOKEN()).to.equal(core.gmxEcosystem!.gmx.address);
      expect(await gmxFactory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
      expect(await gmxFactory.userVaultImplementation()).to.equal(vaultImplementation.address);
      expect(await gmxFactory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#createVault', () => {
    it('should work properly with GLP vault with no balance', async () => {
      await glpFactory.connect(core.hhUser1).createVault(core.hhUser1.address);
      const glpVaultContract = GLPIsolationModeTokenVaultV2__factory.connect(
        await glpFactory.getVaultByAccount(core.hhUser1.address),
        core.hhUser1,
      );

      const result = await gmxFactory.connect(core.hhUser1).createVault(core.hhUser1.address);
      await checkVaultCreationResults(result);
      expect(await glpVaultContract.hasSynced()).to.be.true;
    });

    it('should work properly with no GLP vault', async () => {
      const result = await gmxFactory.connect(core.hhUser1).createVault(core.hhUser1.address);
      await checkVaultCreationResults(result);
    });

    it('should work properly with Glp vault with balance', async () => {
      // Reset glp vault to V1 and create vault
      const glpV1VaultImplementation = await createGLPIsolationModeTokenVaultV1();
      await glpFactory.connect(core.governance).ownerSetUserVaultImplementation(glpV1VaultImplementation.address);
      const glpVaultAddress = await glpFactory.calculateVaultByAccount(core.hhUser1.address);
      await core.gmxEcosystem!.sGlp.connect(core.hhUser1).approve(glpVaultAddress, MAX_UINT_256_BI);
      await glpFactory.connect(core.hhUser1).createVaultAndDepositIntoDolomiteMargin(
        toAccountNumber,
        glpAmount,
      );
      const glpVault = GLPIsolationModeTokenVaultV2__factory.connect(
        glpVaultAddress,
        core.hhUser1,
      );

      // Stake GMX
      await setupGMXBalance(core, core.hhUser1, gmxAmount, glpVault);
      await glpVault.stakeGmx(gmxAmount);
      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).to.eq(gmxAmount);

      // Upgrade GLP vault factory to V2 and create GMX vault
      const glpV2VaultImplementation = await createGLPIsolationModeTokenVaultV2();
      await glpFactory.connect(core.governance).ownerSetUserVaultImplementation(glpV2VaultImplementation.address);
      const result = await gmxFactory.connect(core.hhUser1).createVault(core.hhUser1.address);
      const gmxVaultAddress = await gmxFactory.calculateVaultByAccount(core.hhUser1.address);
      const gmxVault = GMXIsolationModeTokenVaultV1__factory.connect(
        gmxVaultAddress,
        core.hhUser1,
      );

      await checkVaultCreationResults(result);
      expect(await glpVault.hasSynced()).to.be.true;
      expect(await gmxVault.shouldSkipTransfer()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, 0, underlyingMarketIdGmx, gmxAmount);
      await expectProtocolBalance(core, glpVault.address, 0, underlyingMarketIdGmx, ZERO_BI);
      await expectWalletBalance(gmxVault.address, core.gmxEcosystem!.gmx, ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).to.eq(gmxAmount);
    });

    it('should fail when account passed is the zero address', async () => {
      await expectThrow(
        gmxFactory.createVault(ZERO_ADDRESS),
        'IsolationModeVaultFactory: Invalid account',
      );
    });

    it('should fail when vault is already created', async () => {
      const result = await gmxFactory.createVault(core.hhUser1.address);
      await checkVaultCreationResults(result);

      await expectThrow(
        gmxFactory.createVault(core.hhUser1.address),
        'IsolationModeVaultFactory: Vault already exists',
      );
    });

    it('should fail when factory is not initialized', async () => {
      const uninitializedFactory = await createGMXIsolationModeVaultFactory(core, gmxRegistry, vaultImplementation);
      await expectThrow(
        uninitializedFactory.createVault(core.hhUser1.address),
        'IsolationModeVaultFactory: Not initialized',
      );
    });
  });

  describe('#executeDepositIntoVaultFromGLPVault', () => {
    it('should work normally with shouldSkipTransfer is true', async () => {
      await gmxFactory.connect(core.hhUser1).createVault(core.hhUser1.address);
      const gmxVaultAddress = await gmxFactory.calculateVaultByAccount(core.hhUser1.address);
      const gmxVault = GMXIsolationModeTokenVaultV1__factory.connect(
        gmxVaultAddress,
        core.hhUser1,
      );
      const glpVaultImpersonator = await impersonate(await glpFactory.getVaultByAccount(core.hhUser1.address), true);

      await gmxFactory.connect(glpVaultImpersonator).executeDepositIntoVaultFromGLPVault(
        gmxVault.address,
        toAccountNumber,
        gmxAmount,
        true,
      );
      expect(await gmxVault.shouldSkipTransfer()).to.be.false;
      expect(await gmxVault.isDepositSourceGLPVault()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, toAccountNumber, underlyingMarketIdGmx, gmxAmount);
    });

    it('should work normally with shouldSkipTransfer is false', async () => {
      await gmxFactory.connect(core.hhUser1).createVault(core.hhUser1.address);
      const gmxVaultAddress = await gmxFactory.calculateVaultByAccount(core.hhUser1.address);
      const gmxVault = GMXIsolationModeTokenVaultV1__factory.connect(
        gmxVaultAddress,
        core.hhUser1,
      );
      const glpVaultImpersonator = await impersonate(await glpFactory.getVaultByAccount(core.hhUser1.address), true);
      await setupGMXBalance(core, glpVaultImpersonator, gmxAmount, gmxVault);

      await gmxFactory.connect(glpVaultImpersonator).executeDepositIntoVaultFromGLPVault(
        gmxVault.address,
        toAccountNumber,
        gmxAmount,
        false,
      );
      expect(await gmxVault.shouldSkipTransfer()).to.be.false;
      expect(await gmxVault.isDepositSourceGLPVault()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, toAccountNumber, underlyingMarketIdGmx, gmxAmount);
    });

    it('should work do nothing when amountWei is 0', async () => {
      await gmxFactory.connect(core.hhUser1).createVault(core.hhUser1.address);
      const gmxVaultAddress = await gmxFactory.calculateVaultByAccount(core.hhUser1.address);
      const gmxVault = GMXIsolationModeTokenVaultV1__factory.connect(
        gmxVaultAddress,
        core.hhUser1,
      );
      const glpVaultImpersonator = await impersonate(await glpFactory.getVaultByAccount(core.hhUser1.address), true);
      await setupGMXBalance(core, glpVaultImpersonator, gmxAmount, gmxVault);

      await gmxFactory.connect(glpVaultImpersonator).executeDepositIntoVaultFromGLPVault(
        gmxVault.address,
        toAccountNumber,
        ZERO_BI,
        false,
      );
      await gmxFactory.connect(glpVaultImpersonator).executeDepositIntoVaultFromGLPVault(
        gmxVault.address,
        toAccountNumber,
        ZERO_BI,
        true,
      );
      expect(await gmxVault.shouldSkipTransfer()).to.be.false;
      expect(await gmxVault.isDepositSourceGLPVault()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, toAccountNumber, underlyingMarketIdGmx, ZERO_BI);
    });

    it('should fail if not called by GLP vault', async () => {
      await gmxFactory.connect(core.hhUser1).createVault(core.hhUser1.address);
      const gmxVaultAddress = await gmxFactory.calculateVaultByAccount(core.hhUser1.address);
      const gmxVault = GMXIsolationModeTokenVaultV1__factory.connect(
        gmxVaultAddress,
        core.hhUser1,
      );

      await expectThrow(
        gmxFactory.connect(core.hhUser1).executeDepositIntoVaultFromGLPVault(
          gmxVault.address,
          toAccountNumber,
          parseEther('10'),
          true,
        ),
        'GMXIsolationModeVaultFactory: Invalid GLP vault',
      );
    });
  });

  describe('#setGmxRegistry', () => {
    it('should work normally', async () => {
      const result = await gmxFactory.connect(core.governance).setGmxRegistry(OTHER_ADDRESS);
      await expectEvent(gmxFactory, result, 'GmxRegistrySet', {
        gmxRegistry: OTHER_ADDRESS,
      });
      expect(await gmxFactory.gmxRegistry()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        gmxFactory.connect(core.hhUser1).setGmxRegistry(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#allowableCollateralMarketIds', () => {
    it('should work normally', async () => {
      expect(await gmxFactory.allowableCollateralMarketIds()).to.deep.equal([]);
    });
  });

  describe('#allowableDebtMarketIds', () => {
    it('should work normally', async () => {
      expect(await gmxFactory.allowableDebtMarketIds()).to.deep.equal([]);
    });
  });
});
