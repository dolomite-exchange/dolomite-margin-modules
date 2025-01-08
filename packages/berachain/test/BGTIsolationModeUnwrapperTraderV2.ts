import { IERC20 } from '@dolomite-exchange/modules-base/src/types';
import {
  Network,
  ONE_DAY_SECONDS,
  ONE_ETH_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, setEtherBalance, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectThrow,
  expectWalletBalance,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  disableInterestAccrual,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  BerachainRewardsIsolationModeTokenVaultV1,
  BerachainRewardsIsolationModeTokenVaultV1__factory,
  BerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsMetaVault,
  BerachainRewardsMetaVault__factory,
  BerachainRewardsRegistry,
  BGTIsolationModeTokenVaultV1,
  BGTIsolationModeTokenVaultV1__factory,
  BGTIsolationModeUnwrapperTraderV2,
  BGTIsolationModeUnwrapperTraderV2__factory,
  BGTIsolationModeVaultFactory,
  INativeRewardVault,
  InfraredBGTIsolationModeVaultFactory,
} from '../src/types';
import {
  createBerachainRewardsIsolationModeTokenVaultV1,
  createBerachainRewardsIsolationModeVaultFactory,
  createBerachainRewardsRegistry,
  createBGTIsolationModeTokenVaultV1,
  createBGTIsolationModeVaultFactory,
  createInfraredBGTIsolationModeTokenVaultV1,
  createInfraredBGTIsolationModeVaultFactory,
} from './berachain-ecosystem-utils';
import { createDolomiteAccountRegistryImplementation, setupNewGenericTraderProxy } from 'packages/base/test/utils/dolomite';
import { BYTES_EMPTY } from '@dolomite-exchange/zap-sdk/dist/src/lib/Constants';
import { AccountInfoStruct } from 'packages/base/src/utils';
import { getBGTIsolationModeUnwrapperTraderV2ConstructorParams } from '../src/berachain-constructors';

const LP_TOKEN_WHALE_ADDRESS = '0xe3b9B72ba027FD6c514C0e5BA075Ac9c77C23Afa';
const defaultAccountNumber = ZERO_BI;
const amountWei = parseEther('.5');

describe('BGTIsolationModeUnwrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: BerachainRewardsRegistry;
  let beraFactory: BerachainRewardsIsolationModeVaultFactory;
  let otherFactory: BerachainRewardsIsolationModeVaultFactory;

  let bgtFactory: BGTIsolationModeVaultFactory;
  let bgtUnwrapper: BGTIsolationModeUnwrapperTraderV2;

  let iBgtFactory: InfraredBGTIsolationModeVaultFactory;

  let underlyingToken: IERC20;
  let otherUnderlyingToken: IERC20;
  let nativeRewardVault: INativeRewardVault;

  let beraVault: BerachainRewardsIsolationModeTokenVaultV1;
  let metaVault: BerachainRewardsMetaVault;
  let bgtVault: BGTIsolationModeTokenVaultV1;

  let bgtMarketId: BigNumber;
  let bgtBal: BigNumber;
  let defaultAccount: AccountInfoStruct;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 8_629_900,
      network: Network.Berachain,
    });
    await setEtherBalance(core.governance.address, parseEther('100'));
    await disableInterestAccrual(core, core.marketIds.wbera);

    const dolomiteAccountRegistry = await createDolomiteAccountRegistryImplementation();
    await core.dolomiteAccountRegistryProxy.connect(core.governance).upgradeTo(dolomiteAccountRegistry.address);

    underlyingToken = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset;
    otherUnderlyingToken = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyWbera.asset;
    nativeRewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.nativeRewardVault;

    const metaVaultImplementation = await createContractWithAbi<BerachainRewardsMetaVault>(
      BerachainRewardsMetaVault__factory.abi,
      BerachainRewardsMetaVault__factory.bytecode,
      [],
    );
    registry = await createBerachainRewardsRegistry(core, metaVaultImplementation);

    const vaultImplementation = await createBerachainRewardsIsolationModeTokenVaultV1();
    beraFactory = await createBerachainRewardsIsolationModeVaultFactory(
      registry,
      underlyingToken,
      vaultImplementation,
      core,
    );
    otherFactory = await createBerachainRewardsIsolationModeVaultFactory(
      registry,
      otherUnderlyingToken,
      vaultImplementation,
      core,
    );

    const bgtVaultImplementation = await createBGTIsolationModeTokenVaultV1();
    bgtFactory = await createBGTIsolationModeVaultFactory(registry, core.tokens.bgt, bgtVaultImplementation, core);
    bgtUnwrapper = await createContractWithAbi<BGTIsolationModeUnwrapperTraderV2>(
      BGTIsolationModeUnwrapperTraderV2__factory.abi,
      BGTIsolationModeUnwrapperTraderV2__factory.bytecode,
      getBGTIsolationModeUnwrapperTraderV2ConstructorParams(registry, bgtFactory, core),
    );
    await core.dolomiteAccountRegistry.connect(core.governance).ownerSetTransferTokenOverride(
      bgtFactory.address,
      core.tokens.wbera.address
    );

    const iBgtVaultImplementation = await createInfraredBGTIsolationModeTokenVaultV1();
    iBgtFactory = await createInfraredBGTIsolationModeVaultFactory(
      registry,
      core.tokens.iBgt,
      iBgtVaultImplementation,
      core,
    );

    await core.testEcosystem!.testPriceOracle.setPrice(iBgtFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, iBgtFactory, true);

    await core.testEcosystem!.testPriceOracle.setPrice(beraFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, beraFactory, true);

    bgtMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(bgtFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, bgtFactory, true);

    await core.testEcosystem!.testPriceOracle.setPrice(otherFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, otherFactory, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(beraFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(otherFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(bgtFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(iBgtFactory.address, true);
    await beraFactory.connect(core.governance).ownerInitialize([]);
    await otherFactory.connect(core.governance).ownerInitialize([]);
    await bgtFactory.connect(core.governance).ownerInitialize([bgtUnwrapper.address]);
    await iBgtFactory.connect(core.governance).ownerInitialize([]);
    await registry.connect(core.governance).ownerSetBgtIsolationModeVaultFactory(bgtFactory.address);
    await registry.connect(core.governance).ownerSetIBgtIsolationModeVaultFactory(iBgtFactory.address);

    await beraFactory.createVault(core.hhUser1.address);
    beraVault = setupUserVaultProxy<BerachainRewardsIsolationModeTokenVaultV1>(
      await beraFactory.getVaultByAccount(core.hhUser1.address),
      BerachainRewardsIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    metaVault = BerachainRewardsMetaVault__factory.connect(
      await registry.getMetaVaultByAccount(core.hhUser1.address),
      core.hhUser1,
    );

    const lpWhale = await impersonate(LP_TOKEN_WHALE_ADDRESS, true);
    await underlyingToken.connect(lpWhale).transfer(core.hhUser1.address, amountWei);
    await underlyingToken.connect(core.hhUser1).approve(beraVault.address, amountWei);

    await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
    await increase(10 * ONE_DAY_SECONDS);
    await metaVault.getReward(underlyingToken.address);

    // Get the vault now that it has been created
    bgtVault = setupUserVaultProxy<BGTIsolationModeTokenVaultV1>(
      await bgtFactory.getVaultByAccount(core.hhUser1.address),
      BGTIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    bgtBal = await core.tokens.bgt.balanceOf(metaVault.address);
    await expectProtocolBalance(core, bgtVault, defaultAccountNumber, bgtMarketId, bgtBal);

    await setupNewGenericTraderProxy(core, bgtMarketId);

    defaultAccount = { owner: bgtVault.address, number: defaultAccountNumber };

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#Actions.Call and Actions.Sell for non-liquidation', () => {
    it('should work when called with the normal conditions', async () => {
      const solidAccountId = 0;
      const liquidAccountId = 0;
      const actions = await bgtUnwrapper.createActionsForUnwrapping({
        primaryAccountId: solidAccountId,
        otherAccountId: liquidAccountId,
        primaryAccountOwner: bgtVault.address,
        primaryAccountNumber: defaultAccountNumber,
        otherAccountOwner: bgtVault.address,
        otherAccountNumber: defaultAccountNumber,
        outputMarket: core.marketIds.wbera,
        inputMarket: bgtMarketId,
        minOutputAmount: ZERO_BI,
        inputAmount: bgtBal,
        orderData: BYTES_EMPTY,
      });

      const amountOut = await bgtUnwrapper.getExchangeCost(
        bgtFactory.address,
        core.tokens.wbera.address,
        bgtBal,
        BYTES_EMPTY,
      );

      const genericTrader = await impersonate(core.genericTraderProxy!, true);
      await core.dolomiteMargin.connect(genericTrader).operate(
        [defaultAccount],
        actions,
      );

      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, bgtMarketId);
      expect(underlyingBalanceWei.value).to.eq(ZERO_BI);
      expect(await bgtVault.underlyingBalanceOf()).to.eq(ZERO_BI);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.wbera);
      expect(otherBalanceWei.sign).to.eq(true);
      expect(otherBalanceWei.value).to.eq(amountOut);
    });

    it('should fail for invalid input market', async () => {
      const solidAccountId = 0;
      const liquidAccountId = 0;
      await expectThrow(
        bgtUnwrapper.createActionsForUnwrapping({
          primaryAccountId: solidAccountId,
          otherAccountId: liquidAccountId,
          primaryAccountOwner: bgtVault.address,
          primaryAccountNumber: defaultAccountNumber,
          otherAccountOwner: bgtVault.address,
          otherAccountNumber: defaultAccountNumber,
          outputMarket: core.marketIds.wbera,
          inputMarket: core.marketIds.weth,
          minOutputAmount: ZERO_BI,
          inputAmount: bgtBal,
          orderData: BYTES_EMPTY,
        }),
        `IsolationModeUnwrapperTraderV2: Invalid input market <${core.marketIds.weth.toString()}>`,
      );
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        bgtUnwrapper.connect(core.hhUser1).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.wbera.address,
          bgtFactory.address,
          bgtBal,
          BYTES_EMPTY,
        ),
      );
    });

    it('should fail if input token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        bgtUnwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.weth.address,
          bgtFactory.address,
          bgtBal,
          BYTES_EMPTY,
        ),
      );
    });

    it('should fail if output token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        bgtUnwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.weth.address,
          bgtFactory.address,
          bgtBal,
          BYTES_EMPTY,
        ),
      );
    });

    it('should fail if input amount is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        bgtUnwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.weth.address,
          bgtFactory.address,
          bgtBal,
          BYTES_EMPTY,
        ),
      );
    });
  });

  describe('#token', () => {
    it('should work', async () => {
      expect(await bgtUnwrapper.token()).to.eq(bgtFactory.address);
    });
  });

  describe('#actionsLength', () => {
    it('should work', async () => {
      expect(await bgtUnwrapper.actionsLength()).to.eq(2);
    });
  });

  describe('#berachainRewardsRegistry', () => {
    it('should work', async () => {
      expect(await bgtUnwrapper.BERACHAIN_REWARDS_REGISTRY()).to.eq(registry.address);
    });
  });

  describe('#getExchangeCost', () => {
    it('should work', async () => {
      expect(await bgtUnwrapper.getExchangeCost(
        bgtFactory.address,
        core.tokens.wbera.address,
        bgtBal,
        BYTES_EMPTY,
      )).to.eq(bgtBal);
    });
  });
});
