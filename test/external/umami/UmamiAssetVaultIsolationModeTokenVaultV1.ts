import { expect } from 'chai';
import {
  IUmamiAggregateVault__factory,
  IUmamiAssetVault,
  TestUmamiWithdrawalQueuer__factory,
  UmamiAssetVaultIsolationModeTokenVaultV1,
  UmamiAssetVaultIsolationModeTokenVaultV1__factory,
  UmamiAssetVaultIsolationModeUnwrapperTraderV2,
  UmamiAssetVaultIsolationModeVaultFactory,
  UmamiAssetVaultIsolationModeWrapperTraderV2,
  UmamiAssetVaultPriceOracle,
  UmamiAssetVaultRegistry,
} from '../../../src/types';
import { Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import {
  createUmamiAssetVaultIsolationModeTokenVaultV1,
  createUmamiAssetVaultIsolationModeUnwrapperTraderV2,
  createUmamiAssetVaultIsolationModeVaultFactory,
  createUmamiAssetVaultIsolationModeWrapperTraderV2,
  createUmamiAssetVaultPriceOracle,
  createUmamiAssetVaultRegistry,
} from '../../utils/ecosystem-token-utils/umami';
import {
  CoreProtocol,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '../../utils/setup';
import { BigNumber } from 'ethers';
import { createContractWithAbi } from 'src/utils/dolomite-utils';
import { expectProtocolBalance, expectThrow } from 'test/utils/assertions';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const usdcAmount = BigNumber.from('1000000000'); // $1000

describe('UmamiAssetVaultIsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IUmamiAssetVault;
  let umamiRegistry: UmamiAssetVaultRegistry;
  let unwrapper: UmamiAssetVaultIsolationModeUnwrapperTraderV2;
  let wrapper: UmamiAssetVaultIsolationModeWrapperTraderV2;
  let priceOracle: UmamiAssetVaultPriceOracle;
  let factory: UmamiAssetVaultIsolationModeVaultFactory;
  let marketId: BigNumber;
  let vault: UmamiAssetVaultIsolationModeTokenVaultV1;
  let underlyingAmount: BigNumber;
  let impersonatedFactory: SignerWithAddress;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    underlyingToken = core.umamiEcosystem!.glpUsdc.connect(core.hhUser1);
    const userVaultImplementation = await createUmamiAssetVaultIsolationModeTokenVaultV1();

    umamiRegistry = await createUmamiAssetVaultRegistry(core);
    factory = await createUmamiAssetVaultIsolationModeVaultFactory(
      core,
      umamiRegistry,
      underlyingToken,
      userVaultImplementation,
    );
    impersonatedFactory = await impersonate(factory.address, true);
    unwrapper = await createUmamiAssetVaultIsolationModeUnwrapperTraderV2(core, umamiRegistry, factory);
    wrapper = await createUmamiAssetVaultIsolationModeWrapperTraderV2(core, umamiRegistry, factory);
    priceOracle = await createUmamiAssetVaultPriceOracle(core, umamiRegistry, factory);

    const TestUmamiWithdrawalQueuer = await createContractWithAbi(
      TestUmamiWithdrawalQueuer__factory.abi,
      TestUmamiWithdrawalQueuer__factory.bytecode,
      []
    );
    await umamiRegistry.connect(core.governance).ownerSetWithdrawalQueuer(TestUmamiWithdrawalQueuer.address);
    await umamiRegistry.connect(core.governance).ownerSetUmamiUnwrapperTrader(unwrapper.address);


    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<UmamiAssetVaultIsolationModeTokenVaultV1>(
      vaultAddress,
      UmamiAssetVaultIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    await setupUSDCBalance(core, core.hhUser1, usdcAmount, underlyingToken);
    underlyingAmount = await underlyingToken.connect(core.hhUser1).previewDeposit(usdcAmount);
    await underlyingToken.connect(core.hhUser1).deposit(usdcAmount, core.hhUser1.address);

    await unwrapper.connect(core.governance).ownerSetIsHandler(core.hhUser2.address, true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe.only('#initiateUnwrapping', () => {
    it.only('should work', async () => {
      await underlyingToken.connect(core.hhUser1).approve(vault.address, underlyingAmount);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, underlyingAmount);
      await vault.transferIntoPositionWithUnderlyingToken(
        defaultAccountNumber,
        borrowAccountNumber,
        underlyingAmount,
      );
      await vault.connect(core.hhUser1).initiateUnwrapping(
        borrowAccountNumber,
        underlyingAmount,
        core.tokens.usdc.address,
        ONE_BI
      );

      expect(await vault.isVaultFrozen()).to.be.true;
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);
      expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, underlyingAmount);

      const impersonatedUnwrapper = await impersonate(unwrapper.address, true);
      await setupUSDCBalance(core, impersonatedUnwrapper, 100e6, core.hhUser5);
      await unwrapper.connect(core.hhUser2).afterWithdrawalExecution(vault.address, underlyingAmount, 100e6);

      expect(await vault.isVaultFrozen()).to.be.false;
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);
      expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, ZERO_BI);
      expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.usdc, 100e6);
    });

    it('should fail if the vault is frozen', async () => {
      await vault.connect(impersonatedFactory).setIsVaultFrozen(true);
      await expectThrow(
        vault.connect(core.hhUser1).initiateUnwrapping(
          borrowAccountNumber,
          underlyingAmount,
          core.tokens.usdc.address,
          ONE_BI
        ),
        'IsolationModeVaultV1Freezable: Vault is frozen',
      );
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).initiateUnwrapping(
          borrowAccountNumber,
          underlyingAmount,
          core.tokens.usdc.address,
          ONE_BI
        ),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail if reentrant', async () => {});
  });

  describe('#dolomiteRegistry', () => {
    it('should work', async () => {
      expect(await vault.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });
  });

  describe('#registry', () => {
    it('should work normally', async () => {
      expect(await vault.registry()).to.equal(umamiRegistry.address);
    });
  });

  describe('#isExternalRedemptionPaused', () => {
    it('should work normally', async () => {
      expect(await vault.isExternalRedemptionPaused()).to.be.false;
    });

    it('should be paused when aggregateVault pauses vault', async () => {
      const aggregateVault = IUmamiAggregateVault__factory.connect(
        await core.umamiEcosystem!.glpUsdc.connect(core.hhUser1).aggregateVault(),
        core.umamiEcosystem!.configurator,
      );

      expect(await vault.isExternalRedemptionPaused()).to.be.false;

      const admin = await impersonate(aggregateVault.address, true);
      await core.umamiEcosystem!.glpUsdc.connect(admin).pauseDepositWithdraw();
      expect(await vault.isExternalRedemptionPaused()).to.be.true;

      await core.umamiEcosystem!.glpUsdc.connect(admin).unpauseDepositWithdraw();
      expect(await vault.isExternalRedemptionPaused()).to.be.false;
    });
  });
});
