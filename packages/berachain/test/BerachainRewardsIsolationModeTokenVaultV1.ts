import { expect } from 'chai';
import {
  BerachainRewardsIsolationModeTokenVaultV1,
  BerachainRewardsIsolationModeTokenVaultV1__factory,
  BerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsRegistry,
  IBeraRewardVault,
  IBeraRewardVault__factory,
  IERC20__factory,
} from '../src/types';
import {
  IERC20,
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2,
} from '@dolomite-exchange/modules-base/src/types';
import { ADDRESS_ZERO, Network, ONE_ETH_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectProtocolBalance, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { createBerachainRewardsIsolationModeTokenVaultV1, createBerachainRewardsIsolationModeVaultFactory, createBerachainRewardsRegistry, createBerachainRewardsUnwrapperTraderV2, createBerachainRewardsWrapperTraderV2 } from './berachain-ecosystem-utils';
import { TokenInfo } from 'packages/oracles/src';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';

const HONEY_USDC_LP_TOKEN = '0xD69ADb6FB5fD6D06E6ceEc5405D95A37F96E3b96';
const LP_TOKEN_WHALE_ADDRESS = '0x1293DA55eC372a94368Fa20E8DF69FaBc3320baE';
const LP_REWARD_VAULT = '0xe3b9B72ba027FD6c514C0e5BA075Ac9c77C23Afa';
const defaultAccountNumber = ZERO_BI;
const amountWei = ONE_ETH_BI;

describe('BerachainRewardsIsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let underlyingToken: IERC20;
  let beraRegistry: BerachainRewardsRegistry;
  let unwrapper: SimpleIsolationModeUnwrapperTraderV2;
  let wrapper: SimpleIsolationModeWrapperTraderV2;
  let beraFactory: BerachainRewardsIsolationModeVaultFactory;
  let beraVault: BerachainRewardsIsolationModeTokenVaultV1;
  let rewardVault: IBeraRewardVault;
  let marketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 4_853_900,
      network: Network.Berachain,
    });

    underlyingToken = IERC20__factory.connect(HONEY_USDC_LP_TOKEN, core.hhUser1);
    rewardVault = IBeraRewardVault__factory.connect(LP_REWARD_VAULT, core.hhUser1);
    beraRegistry = await createBerachainRewardsRegistry(core, rewardVault);
    
    const lpWhale = await impersonate(LP_TOKEN_WHALE_ADDRESS);
    await underlyingToken.connect(lpWhale).transfer(core.hhUser1.address, amountWei);

    const vaultImplementation = await createBerachainRewardsIsolationModeTokenVaultV1();
    beraFactory = await createBerachainRewardsIsolationModeVaultFactory(beraRegistry, underlyingToken, vaultImplementation, core);

    unwrapper = await createBerachainRewardsUnwrapperTraderV2(beraFactory, core);
    wrapper = await createBerachainRewardsWrapperTraderV2(beraFactory, core);

    marketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(beraFactory.address, amountWei);
    await setupTestMarket(core, beraFactory, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(beraFactory.address, true);
    await beraFactory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    await beraFactory.createVault(core.hhUser1.address);
    beraVault = setupUserVaultProxy<BerachainRewardsIsolationModeTokenVaultV1>(
      await beraFactory.getVaultByAccount(core.hhUser1.address),
      BerachainRewardsIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    await underlyingToken.approve(beraVault.address, amountWei);
    await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
    await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#stake', () => {
    it('should work normally', async () => {
      await beraVault.stake(amountWei);
      expect(await rewardVault.balanceOf(beraVault.address)).to.equal(amountWei);
    });
  });

  describe('#withdraw', () => {
    it('should work normally', async () => {
      await beraVault.stake(amountWei);
      expect(await rewardVault.balanceOf(beraVault.address)).to.equal(amountWei);
      await beraVault.withdraw(parseEther('.5'));
      expect(await rewardVault.balanceOf(beraVault.address)).to.equal(parseEther('.5'));
    });
  });

  describe('#dolomiteRegistry', () => {
    it('should work', async () => {
      expect(await beraVault.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });
  });

  describe('#registry', () => {
    it('should work', async () => {
      expect(await beraVault.registry()).to.equal(beraRegistry.address);
    });
  });
});
