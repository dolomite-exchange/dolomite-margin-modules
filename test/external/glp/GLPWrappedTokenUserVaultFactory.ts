import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  GLPWrappedTokenUserVaultFactory,
  GLPWrappedTokenUserVaultFactory__factory,
  GLPWrappedTokenUserVaultV1,
  GLPWrappedTokenUserVaultV1__factory,
  GmxRegistryV1,
  TestGLPWrappedTokenUserVaultV1,
  TestGLPWrappedTokenUserVaultV1__factory,
} from '../../../src/types';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { Network, ONE_BI, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectEvent, expectThrow } from '../../utils/assertions';
import {
  CoreProtocol,
  setupCoreProtocol,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '../../utils/setup';
import { createGmxRegistry } from '../../utils/wrapped-token-utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('GLPWrappedTokenUserVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let gmxRegistry: GmxRegistryV1;
  let vaultImplementation: TestGLPWrappedTokenUserVaultV1;
  let factory: GLPWrappedTokenUserVaultFactory;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 53107700,
      network: Network.ArbitrumOne,
    });
    gmxRegistry = await createGmxRegistry(core);
    vaultImplementation = await createContractWithAbi<TestGLPWrappedTokenUserVaultV1>(
      TestGLPWrappedTokenUserVaultV1__factory.abi,
      TestGLPWrappedTokenUserVaultV1__factory.bytecode,
      [],
    );
    factory = await createContractWithAbi<GLPWrappedTokenUserVaultFactory>(
      GLPWrappedTokenUserVaultFactory__factory.abi,
      GLPWrappedTokenUserVaultFactory__factory.bytecode,
      [
        core.weth.address,
        core.marketIds.weth,
        gmxRegistry.address,
        core.gmxEcosystem!.fsGlp.address,
        core.borrowPositionProxyV2.address,
        vaultImplementation.address,
        core.dolomiteMargin.address,
      ],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await factory.WETH()).to.equal(core.weth.address);
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
        core.usdc.address,
        usdcAmount,
        ONE_BI,
        ONE_BI,
      );
      // use sGLP for approvals/transfers and fsGLP for checking balances
      const glpAmount = await core.gmxEcosystem!.fsGlp.connect(core.hhUser1).balanceOf(core.hhUser1.address);
      const vaultAddress = await factory.connect(core.hhUser2).calculateVaultByAccount(core.hhUser2.address);
      await core.gmxEcosystem!.gmxRewardsRouter.connect(core.hhUser1).signalTransfer(vaultAddress);

      await core.testPriceOracle.setPrice(factory.address, '1000000000000000000');
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await setupTestMarket(core, factory, true);
      await factory.connect(core.governance).ownerInitialize([]);

      await factory.connect(core.hhUser2).createVaultAndAcceptFullAccountTransfer(core.hhUser1.address);
      const vault = setupUserVaultProxy<GLPWrappedTokenUserVaultV1>(
        vaultAddress,
        GLPWrappedTokenUserVaultV1__factory,
        core.hhUser2,
      );
      expect(await core.gmxEcosystem!.fsGlp.connect(core.hhUser1).balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.fsGlp.connect(core.hhUser1).balanceOf(vaultAddress)).to.eq(glpAmount);
      expect(await vault.underlyingBalanceOf()).to.eq(glpAmount);
    });

    it('should fail when not initialized yet', async () => {
      await expectThrow(
        factory.connect(core.hhUser2).createVaultAndAcceptFullAccountTransfer(core.hhUser1.address),
        'WrappedTokenUserVaultFactory: Not initialized',
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
