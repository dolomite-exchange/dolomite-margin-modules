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
  BGTMERC20Wrapper,
  BGTMERC20Wrapper__factory,
  BGTMIsolationModeTokenVaultV1,
  BGTMIsolationModeTokenVaultV1__factory,
  BGTMIsolationModeUnwrapperTraderV2,
  BGTMIsolationModeUnwrapperTraderV2__factory,
  BGTMIsolationModeVaultFactory,
  INativeRewardVault,
  InfraredBGTIsolationModeVaultFactory,
} from '../src/types';
import {
  createBerachainRewardsIsolationModeTokenVaultV1,
  createBerachainRewardsIsolationModeVaultFactory,
  createBerachainRewardsRegistry,
  createBGTIsolationModeTokenVaultV1,
  createBGTIsolationModeVaultFactory,
  createBGTMIsolationModeTokenVaultV1,
  createBGTMIsolationModeVaultFactory,
  createInfraredBGTIsolationModeTokenVaultV1,
  createInfraredBGTIsolationModeVaultFactory,
  RewardVaultType,
} from './berachain-ecosystem-utils';
import { createDolomiteAccountRegistryImplementation, setupNewGenericTraderProxy } from 'packages/base/test/utils/dolomite';
import { BYTES_EMPTY } from '@dolomite-exchange/zap-sdk/dist/src/lib/Constants';
import { AccountInfoStruct } from 'packages/base/src/utils';

const LP_TOKEN_WHALE_ADDRESS = '0xe3b9B72ba027FD6c514C0e5BA075Ac9c77C23Afa';
const defaultAccountNumber = ZERO_BI;
const amountWei = parseEther('.5');

describe('BGTMIsolationModeUnwrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: BerachainRewardsRegistry;
  let beraFactory: BerachainRewardsIsolationModeVaultFactory;
  let otherFactory: BerachainRewardsIsolationModeVaultFactory;

  let bgtmFactory: BGTMIsolationModeVaultFactory;

  let bgtFactory: BGTIsolationModeVaultFactory;
  let bgtmUnwrapper: BGTMIsolationModeUnwrapperTraderV2;
  let iBgtFactory: InfraredBGTIsolationModeVaultFactory;

  let underlyingToken: IERC20;
  let otherUnderlyingToken: IERC20;
  let nativeRewardVault: INativeRewardVault;
  let bgtmWrapper: BGTMERC20Wrapper;

  let beraVault: BerachainRewardsIsolationModeTokenVaultV1;
  let metaVault: BerachainRewardsMetaVault;
  let bgtVault: BGTIsolationModeTokenVaultV1;
  let bgtmVault: BGTMIsolationModeTokenVaultV1;

  let bgtMarketId: BigNumber;
  let bgtBal: BigNumber;
  let bgtmMarketId: BigNumber;
  let bgtmBal: BigNumber;
  let defaultAccount: AccountInfoStruct;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 8_627_900,
      network: Network.Berachain,
    });
    await setEtherBalance(core.governance.address, parseEther('100'));
    await disableInterestAccrual(core, core.marketIds.wbera);

    bgtmWrapper = await createContractWithAbi<BGTMERC20Wrapper>(
      BGTMERC20Wrapper__factory.abi,
      BGTMERC20Wrapper__factory.bytecode,
      [core.berachainRewardsEcosystem.bgtm.address],
    );

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
    await core.dolomiteAccountRegistry.connect(core.governance).ownerSetTransferTokenOverride(
      bgtFactory.address,
      core.tokens.wbera.address
    );

    const bgtmVaultImplementation = await createBGTMIsolationModeTokenVaultV1();
    bgtmFactory = await createBGTMIsolationModeVaultFactory(registry, bgtmWrapper, bgtmVaultImplementation, core);
    bgtmUnwrapper = await createContractWithAbi<BGTMIsolationModeUnwrapperTraderV2>(
      BGTMIsolationModeUnwrapperTraderV2__factory.abi,
      BGTMIsolationModeUnwrapperTraderV2__factory.bytecode,
      [registry.address, bgtmFactory.address, core.dolomiteMargin.address],
    );
    await core.dolomiteAccountRegistry.connect(core.governance).ownerSetTransferTokenOverride(
      bgtmFactory.address,
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

    bgtmMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(bgtmFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, bgtmFactory, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(beraFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(otherFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(bgtFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(iBgtFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(bgtmFactory.address, true);
    await beraFactory.connect(core.governance).ownerInitialize([]);
    await otherFactory.connect(core.governance).ownerInitialize([]);
    await bgtFactory.connect(core.governance).ownerInitialize([]);
    await iBgtFactory.connect(core.governance).ownerInitialize([]);
    await bgtmFactory.connect(core.governance).ownerInitialize([bgtmUnwrapper.address]);
    await registry.connect(core.governance).ownerSetBgtIsolationModeVaultFactory(bgtFactory.address);
    await registry.connect(core.governance).ownerSetIBgtIsolationModeVaultFactory(iBgtFactory.address);
    await registry.connect(core.governance).ownerSetBgtmIsolationModeVaultFactory(bgtmFactory.address);

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

    await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.BGTM);
    await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
    await increase(10 * ONE_DAY_SECONDS);
    await metaVault.getReward(underlyingToken.address);

    // Get the vault now that it has been created
    bgtmVault = setupUserVaultProxy<BGTMIsolationModeTokenVaultV1>(
      await bgtmFactory.getVaultByAccount(core.hhUser1.address),
      BGTMIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    bgtmBal = await bgtmWrapper.balanceOf(metaVault.address);
    await expectProtocolBalance(core, bgtmVault, defaultAccountNumber, bgtmMarketId, bgtmBal);

    await setupNewGenericTraderProxy(core, bgtmMarketId);

    defaultAccount = { owner: bgtmVault.address, number: defaultAccountNumber };

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#Actions.Call and Actions.Sell for non-liquidation', () => {
    it('should work when called with the normal conditions', async () => {
      const solidAccountId = 0;
      const liquidAccountId = 0;
      const actions = await bgtmUnwrapper.createActionsForUnwrapping({
        primaryAccountId: solidAccountId,
        otherAccountId: liquidAccountId,
        primaryAccountOwner: bgtmVault.address,
        primaryAccountNumber: defaultAccountNumber,
        otherAccountOwner: bgtmVault.address,
        otherAccountNumber: defaultAccountNumber,
        outputMarket: core.marketIds.wbera,
        inputMarket: bgtmMarketId,
        minOutputAmount: ZERO_BI,
        inputAmount: bgtmBal,
        orderData: BYTES_EMPTY,
      });

      const amountOut = await bgtmUnwrapper.getExchangeCost(
        bgtmFactory.address,
        core.tokens.wbera.address,
        bgtmBal,
        BYTES_EMPTY,
      );

      const genericTrader = await impersonate(core.genericTraderProxy!, true);
      await core.dolomiteMargin.connect(genericTrader).operate(
        [defaultAccount],
        actions,
      );

      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, bgtmMarketId);
      expect(underlyingBalanceWei.value).to.eq(ZERO_BI);
      expect(await bgtmVault.underlyingBalanceOf()).to.eq(ZERO_BI);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.wbera);
      expect(otherBalanceWei.sign).to.eq(true);
      console.log(otherBalanceWei.value.toString());
      expect(otherBalanceWei.value).to.eq(amountOut);
    });

    it('should fail for invalid input market', async () => {
      const solidAccountId = 0;
      const liquidAccountId = 0;
      await expectThrow(
        bgtmUnwrapper.createActionsForUnwrapping({
          primaryAccountId: solidAccountId,
          otherAccountId: liquidAccountId,
          primaryAccountOwner: bgtmVault.address,
          primaryAccountNumber: defaultAccountNumber,
          otherAccountOwner: bgtmVault.address,
          otherAccountNumber: defaultAccountNumber,
          outputMarket: core.marketIds.wbera,
          inputMarket: core.marketIds.weth,
          minOutputAmount: ZERO_BI,
          inputAmount: bgtmBal,
          orderData: BYTES_EMPTY,
        }),
        `IsolationModeUnwrapperTraderV2: Invalid input market <${core.marketIds.weth.toString()}>`,
      );
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        bgtmUnwrapper.connect(core.hhUser1).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.wbera.address,
          bgtmFactory.address,
          bgtmBal,
          BYTES_EMPTY,
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`
      );
    });

    it('should fail if input token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        bgtmUnwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.wbera.address,
          bgtFactory.address,
          bgtmBal,
          BYTES_EMPTY,
        ),
        `IsolationModeUnwrapperTraderV2: Invalid input token <${bgtFactory.address.toLowerCase()}>`,
      );
    });

    it('should fail if output token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        bgtmUnwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.weth.address,
          bgtmFactory.address,
          bgtmBal,
          BYTES_EMPTY,
        ),
        `IsolationModeUnwrapperTraderV2: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if input amount is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        bgtmUnwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.wbera.address,
          bgtmFactory.address,
          ZERO_BI,
          BYTES_EMPTY,
        ),
        `IsolationModeUnwrapperTraderV2: Invalid input amount`,
      );
    });
  });

  describe('#token', () => {
    it('should work', async () => {
      expect(await bgtmUnwrapper.token()).to.eq(bgtmFactory.address);
    });
  });

  describe('#actionsLength', () => {
    it('should work', async () => {
      expect(await bgtmUnwrapper.actionsLength()).to.eq(2);
    });
  });

  describe('#berachainRewardsRegistry', () => {
    it('should work', async () => {
      expect(await bgtmUnwrapper.BERACHAIN_REWARDS_REGISTRY()).to.eq(registry.address);
    });
  });

  describe('#getExchangeCost', () => {
    it('should work', async () => {
      expect(await bgtmUnwrapper.getExchangeCost(
        bgtmFactory.address,
        core.tokens.wbera.address,
        bgtmBal,
        BYTES_EMPTY,
      )).to.eq(bgtmBal);
    });
  });
});
