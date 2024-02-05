import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  GLPIsolationModeTokenVaultV1,
  GLPIsolationModeTokenVaultV1__factory,
  GLPIsolationModeVaultFactory,
  GmxRegistryV1,
  TestGLPIsolationModeTokenVaultV1,
} from '../src/types';
import { Network, ONE_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  createGLPIsolationModeVaultFactory,
  createGmxRegistry,
  createTestGLPIsolationModeTokenVaultV1,
} from './glp-ecosystem-utils';
import {
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('GLPIsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let gmxRegistry: GmxRegistryV1;
  let vaultImplementation: TestGLPIsolationModeTokenVaultV1;
  let factory: GLPIsolationModeVaultFactory;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    gmxRegistry = await createGmxRegistry(core);
    vaultImplementation = await createTestGLPIsolationModeTokenVaultV1();
    factory = await createGLPIsolationModeVaultFactory(core, gmxRegistry, vaultImplementation);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await factory.WETH()).to.equal(core.tokens.weth.address);
      expect(await factory.WETH_MARKET_ID()).to.equal(core.marketIds.weth);
      expect(await factory.gmxRegistry()).to.equal(gmxRegistry.address);
      expect(await factory.UNDERLYING_TOKEN()).to.equal(core.gmxEcosystem!.fsGlp.address);
      expect(await factory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
      expect(await factory.userVaultImplementation()).to.equal(vaultImplementation.address);
      expect(await factory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#createVaultAndAcceptFullAccountTransfer', () => {
    it('should work normally', async () => {
      const usdcAmount = BigNumber.from('100000000'); // 100 USDC
      await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
      await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1).mintAndStakeGlp(
        core.tokens.usdc.address,
        usdcAmount,
        ONE_BI,
        ONE_BI,
      );
      // use sGLP for approvals/transfers and fsGLP for checking balances
      const glpAmount = await core.gmxEcosystem!.fsGlp.connect(core.hhUser1).balanceOf(core.hhUser1.address);
      const vaultAddress = await factory.connect(core.hhUser2).calculateVaultByAccount(core.hhUser2.address);
      await core.gmxEcosystem!.gmxRewardsRouterV2.connect(core.hhUser1).signalTransfer(vaultAddress);

      await core.testEcosystem!.testPriceOracle.setPrice(factory.address, '1000000000000000000');
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await setupTestMarket(core, factory, true);
      await factory.connect(core.governance).ownerInitialize([]);

      await factory.connect(core.hhUser2).createVaultAndAcceptFullAccountTransfer(core.hhUser1.address);
      const vault = setupUserVaultProxy<GLPIsolationModeTokenVaultV1>(
        vaultAddress,
        GLPIsolationModeTokenVaultV1__factory,
        core.hhUser2,
      );
      expect(await core.gmxEcosystem!.fsGlp.connect(core.hhUser1).balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.fsGlp.connect(core.hhUser1).balanceOf(vaultAddress)).to.eq(glpAmount);
      expect(await vault.underlyingBalanceOf()).to.eq(glpAmount);
    });

    it('should fail when not initialized yet', async () => {
      await expectThrow(
        factory.connect(core.hhUser2).createVaultAndAcceptFullAccountTransfer(core.hhUser1.address),
        'IsolationModeVaultFactory: Not initialized',
      );
    });
  });

  describe('#setGmxRegistry', () => {
    it('should work normally', async () => {
      const result = await factory.connect(core.governance).setGmxRegistry(OTHER_ADDRESS);
      await expectEvent(factory, result, 'GmxRegistrySet', {
        gmxRegistry: OTHER_ADDRESS,
      });
      expect(await factory.gmxRegistry()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).setGmxRegistry(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#allowableCollateralMarketIds', () => {
    it('should work normally', async () => {
      expect(await factory.allowableCollateralMarketIds()).to.deep.equal([]);
    });
  });

  describe('#allowableDebtMarketIds', () => {
    it('should work normally', async () => {
      expect(await factory.allowableDebtMarketIds()).to.deep.equal([]);
    });
  });
});
