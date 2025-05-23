import {
  DolomiteERC4626,
  DolomiteERC4626__factory,
  LiquidatorProxyV6,
  RegistryProxy__factory,
} from '@dolomite-exchange/modules-base/src/types';
import { Network, ONE_ETH_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectProtocolBalance } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  disableInterestAccrual,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
  setupWETHBalance,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { createContractWithAbi, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { createLiquidatorProxyV6, setupNewGenericTraderProxy } from 'packages/base/test/utils/dolomite';
import {
  BerachainRewardsRegistry,
  IInfraredVault,
  IInfraredVault__factory,
  InfraredBGTIsolationModeVaultFactory,
  InfraredBGTMetaVault,
  InfraredBGTMetaVault__factory,
  POLIsolationModeTokenVaultV1,
  POLIsolationModeTokenVaultV1__factory,
  POLIsolationModeUnwrapperTraderV2,
  POLIsolationModeVaultFactory,
  POLIsolationModeWrapperTraderV2,
  TestPOLLiquidatorProxyV1,
} from '../src/types';
import {
  createBerachainRewardsRegistry,
  createInfraredBGTIsolationModeTokenVaultV1,
  createInfraredBGTIsolationModeVaultFactory,
  createPOLIsolationModeTokenVaultV1,
  createPOLIsolationModeUnwrapperTraderV2,
  createPOLIsolationModeVaultFactory,
  createPOLIsolationModeWrapperTraderV2,
  createTestPolLiquidatorProxy,
  RewardVaultType,
} from './berachain-ecosystem-utils';

const defaultAccountNumber = ZERO_BI;
const amountWei = parseEther('100');

describe('POL_EmptyPOC', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;

  let registry: BerachainRewardsRegistry;
  let factory: POLIsolationModeVaultFactory;
  let iBgtFactory: InfraredBGTIsolationModeVaultFactory;
  let vault: POLIsolationModeTokenVaultV1;
  let wrapper: POLIsolationModeWrapperTraderV2;
  let unwrapper: POLIsolationModeUnwrapperTraderV2;
  let metaVault: InfraredBGTMetaVault;

  let polLiquidatorProxy: TestPOLLiquidatorProxyV1;
  let liquidatorProxyV6: LiquidatorProxyV6;

  let dToken: DolomiteERC4626;
  let infraredVault: IInfraredVault;
  let parAmount: BigNumber;
  let marketId: BigNumber;
  let iBgtMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 2_040_000,
      network: Network.Berachain,
    });
    await disableInterestAccrual(core, core.marketIds.weth);
    liquidatorProxyV6 = await createLiquidatorProxyV6(core);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(liquidatorProxyV6.address, true);

    await setupWETHBalance(core, core.governance, ONE_ETH_BI, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.governance, defaultAccountNumber, core.marketIds.weth, ONE_ETH_BI);
    dToken = DolomiteERC4626__factory.connect(core.dolomiteTokens.weth!.address, core.hhUser1);
    const implementation = await createContractWithAbi<DolomiteERC4626>(
      DolomiteERC4626__factory.abi,
      DolomiteERC4626__factory.bytecode,
      [core.dolomiteRegistry.address, core.dolomiteMargin.address],
    );
    const dTokenProxy = RegistryProxy__factory.connect(dToken.address, core.governance);
    await dTokenProxy.upgradeTo(implementation.address);

    polLiquidatorProxy = await createTestPolLiquidatorProxy(core, liquidatorProxyV6);

    const metaVaultImplementation = await createContractWithAbi<InfraredBGTMetaVault>(
      InfraredBGTMetaVault__factory.abi,
      InfraredBGTMetaVault__factory.bytecode,
      [],
    );
    registry = await createBerachainRewardsRegistry(core, metaVaultImplementation, polLiquidatorProxy);

    infraredVault = IInfraredVault__factory.connect(
      await registry.rewardVault(dToken.address, RewardVaultType.Infrared),
      core.hhUser1,
    );

    const vaultImplementation = await createPOLIsolationModeTokenVaultV1();
    factory = await createPOLIsolationModeVaultFactory(core, registry, dToken, vaultImplementation, [], []);

    const iBgtVaultImplementation = await createInfraredBGTIsolationModeTokenVaultV1();
    iBgtFactory = await createInfraredBGTIsolationModeVaultFactory(
      registry,
      core.tokens.iBgt,
      iBgtVaultImplementation,
      core,
    );

    marketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(factory.address, parseEther('2000')); // same price as WETH
    await setupTestMarket(core, factory, true);

    iBgtMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(iBgtFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, iBgtFactory, true);

    wrapper = await createPOLIsolationModeWrapperTraderV2(core, registry, factory);
    unwrapper = await createPOLIsolationModeUnwrapperTraderV2(core, registry, factory);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(iBgtFactory.address, true);
    await factory.connect(core.governance).ownerInitialize([wrapper.address, unwrapper.address]);
    await iBgtFactory.connect(core.governance).ownerInitialize([]);
    await registry.connect(core.governance).ownerSetIBgtIsolationModeVaultFactory(iBgtFactory.address);

    await factory.createVault(core.hhUser1.address);
    vault = setupUserVaultProxy<POLIsolationModeTokenVaultV1>(
      await factory.getVaultByAccount(core.hhUser1.address),
      POLIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    metaVault = InfraredBGTMetaVault__factory.connect(
      await registry.getMetaVaultByAccount(core.hhUser1.address),
      core.hhUser1,
    );
    await metaVault.setDefaultRewardVaultTypeByAsset(dToken.address, RewardVaultType.Infrared);

    await setupWETHBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);
    await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);
    parAmount = await dToken.balanceOf(core.hhUser1.address);

    await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('2000'));
    await core.dolomiteMargin
      .connect(core.governance)
      .ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(wrapper.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(unwrapper.address, true);
    await setupNewGenericTraderProxy(core, marketId);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(polLiquidatorProxy.address, true);
    await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(marketId, polLiquidatorProxy.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#poc', () => {
    it('should work normally', async () => {
      // After the before, the user has a WETH balance in their default account.
      // To wrap into account number 0 of the vault, uncomment the following line:
      // await wrapFullBalanceIntoVaultDefaultAccount(core, vault, metaVault, wrapper, marketId);
    });
  });
});
