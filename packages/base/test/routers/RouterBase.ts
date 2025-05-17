import { ADDRESS_ZERO, Network, ONE_BI } from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import {
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '../utils/setup';
import {
  CustomTestToken,
  RouterProxy__factory,
  TestIsolationModeTokenVaultV1,
  TestIsolationModeTokenVaultV1__factory,
  TestIsolationModeVaultFactory,
  TestRouterBase,
  TestRouterBase__factory
} from 'packages/base/src/types';
import { createContractWithAbi, createContractWithLibrary, createTestToken } from 'packages/base/src/utils/dolomite-utils';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { createDolomiteAccountRegistryImplementation, createIsolationModeTokenVaultV1ActionsImpl } from '../utils/dolomite';
import { createTestIsolationModeVaultFactory } from '../utils/ecosystem-utils/testers';
import { BigNumber } from 'ethers';
import { expectEvent, expectThrow } from '../utils/assertions';
import { expect } from 'chai';

describe('RouterBase', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let router: TestRouterBase;

  let underlyingToken: CustomTestToken;
  let factory: TestIsolationModeVaultFactory;
  let userVault: TestIsolationModeTokenVaultV1;
  let isolationModeMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));

    const dolomiteAccountRegistry = await createDolomiteAccountRegistryImplementation();
    await core.dolomiteAccountRegistryProxy.connect(core.governance).upgradeTo(dolomiteAccountRegistry.address);

    const implementation = await createContractWithAbi<TestRouterBase>(
      TestRouterBase__factory.abi,
      TestRouterBase__factory.bytecode,
      [core.dolomiteRegistry.address, core.dolomiteMargin.address]
    );
    const initCalldata = await implementation.populateTransaction.initialize();
    const proxy = await createContractWithAbi(
      RouterProxy__factory.abi,
      RouterProxy__factory.bytecode,
      [implementation.address, core.dolomiteMargin.address, initCalldata.data!],
    );
    router = TestRouterBase__factory.connect(proxy.address, core.hhUser1);

    underlyingToken = await createTestToken();
    const libraries = await createIsolationModeTokenVaultV1ActionsImpl();

    const userVaultImplementation = await createContractWithLibrary(
      'TestIsolationModeTokenVaultV1',
      { ...libraries },
      []
    );
    factory = await createTestIsolationModeVaultFactory(core, underlyingToken, userVaultImplementation as any);
    await core.testEcosystem!.testPriceOracle.setPrice(
      factory.address,
      '1000000000000000000', // $1.00
    );
    isolationModeMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(router.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.connect(core.governance).ownerInitialize([router.address]);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    userVault = setupUserVaultProxy<TestIsolationModeTokenVaultV1>(
      vaultAddress,
      TestIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await router.DOLOMITE_REGISTRY()).to.equal(core.dolomiteRegistry.address);
      expect(await router.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#initialize', () => {
    it('should revert if already initialized', async () => {
      await expectThrow(router.initialize(), 'Initializable: contract is already initialized');
    });
  });

  describe('#getMarketInfo', () => {
    it('should work normally for normal asset', async () => {
      const marketInfo = await router.getMarketInfo(core.marketIds.dai);
      expect(marketInfo.marketId).to.equal(core.marketIds.dai);
      expect(marketInfo.isIsolationModeAsset).to.be.false;
      expect(marketInfo.marketToken).to.equal(core.tokens.dai.address);
      expect(marketInfo.token).to.equal(core.tokens.dai.address);
      expect(marketInfo.transferToken).to.equal(core.tokens.dai.address);
      expect(marketInfo.factory).to.equal(ADDRESS_ZERO);
    });

    it('should work normally for isolation mode asset', async () => {
      const marketInfo = await router.getMarketInfo(isolationModeMarketId);
      expect(marketInfo.marketId).to.equal(isolationModeMarketId);
      expect(marketInfo.isIsolationModeAsset).to.be.true;
      expect(marketInfo.marketToken).to.equal(factory.address);
      expect(marketInfo.token).to.equal(underlyingToken.address);
      expect(marketInfo.transferToken).to.equal(underlyingToken.address);
      expect(marketInfo.factory).to.equal(factory.address);
    });

    it('should work normally for isolation mode asset with transfer token', async () => {
      await core.dolomiteAccountRegistry.connect(core.governance).ownerSetTransferTokenOverride(
        factory.address,
        core.tokens.weth.address
      );
      const marketInfo = await router.getMarketInfo(isolationModeMarketId);
      expect(marketInfo.marketId).to.equal(isolationModeMarketId);
      expect(marketInfo.isIsolationModeAsset).to.be.true;
      expect(marketInfo.marketToken).to.equal(factory.address);
      expect(marketInfo.token).to.equal(underlyingToken.address);
      expect(marketInfo.transferToken).to.equal(core.tokens.weth.address);
      expect(marketInfo.factory).to.equal(factory.address);
    });

    it('should revert if invalid marketId', async () => {
      await expect(router.getMarketInfo(isolationModeMarketId.add(ONE_BI))).to.be.reverted;
      await expectThrow(
        router.getMarketInfo(isolationModeMarketId.add(ONE_BI)),
        'Getters: Invalid market'
      );
    });
  });

  describe('#validateIsoMarketAndGetVault', () => {
    it('should work normally', async () => {
      const vault = await router.callStatic.validateIsoMarketAndGetVault(isolationModeMarketId, core.hhUser1.address);
      expect(vault).to.equal(userVault.address);
    });

    it('should create a vault if it does not exist', async () => {
      const vaultAddress = await factory.calculateVaultByAccount(core.hhUser2.address);
      const res = await router.validateIsoMarketAndGetVault(isolationModeMarketId, core.hhUser2.address);
      await expectEvent(factory, res, 'VaultCreated', {
        accountOwner: core.hhUser2.address,
        accountNumber: vaultAddress,
      });
    });

    it('should revert if invalid marketId', async () => {
      await expectThrow(
        router.validateIsoMarketAndGetVault(core.marketIds.dai, core.hhUser1.address),
        'RouterBase: Market is not isolation mode'
      );
    });
  });

  describe('#isIsolationModeAsset', () => {
    it('should work normally', async () => {
      expect(await router.isIsolationModeAssetByMarketId(isolationModeMarketId)).to.be.true;
      expect(await router.isIsolationModeAssetByMarketId(core.marketIds.dArb)).to.be.true;
      expect(await router.isIsolationModeAssetByMarketId(core.marketIds.dGmEth)).to.be.true;
      expect(await router.isIsolationModeAssetByMarketId(core.marketIds.dGmx)).to.be.true;
    });

    it('should work normally for Dolomite GLP', async () => {
      expect(await router.isIsolationModeAssetByMarketId(core.marketIds.dfsGlp)).to.be.true;
    });

    it('should fail for non-Isolation mode asset', async () => {
      expect(await router.isIsolationModeAssetByMarketId(core.marketIds.dai)).to.be.false;
      expect(await router.isIsolationModeAssetByMarketId(core.marketIds.weth)).to.be.false;
      expect(await router.isIsolationModeAssetByMarketId(core.marketIds.usdc)).to.be.false;
      expect(await router.isIsolationModeAssetByMarketId(core.marketIds.arb)).to.be.false;
    });
  });

  describe('#isDolomiteBalance', () => {
    it('should work normally', async () => {
      expect(await router.isDolomiteBalance(0)).to.be.true;
      expect(await router.isDolomiteBalance(99)).to.be.true;
      expect(await router.isDolomiteBalance(100)).to.be.false;
      expect(await router.isDolomiteBalance(300)).to.be.false;
    });
  });
});
