import { IERC20 } from '@dolomite-exchange/modules-base/src/types';
import {
  Network,
  ONE_DAY_SECONDS,
  ONE_ETH_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, setEtherBalance, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import {
  expectProtocolBalance,
  expectThrow,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
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
  BGTMERC20Wrapper,
  BGTMERC20Wrapper__factory,
  BGTMIsolationModeTokenVaultV1,
  BGTMIsolationModeTokenVaultV1__factory,
  BGTMIsolationModeVaultFactory,
} from '../src/types';
import {
  createBerachainRewardsIsolationModeTokenVaultV1,
  createBerachainRewardsIsolationModeVaultFactory,
  createBerachainRewardsRegistry,
  createBGTMIsolationModeTokenVaultV1,
  createBGTMIsolationModeVaultFactory,
} from './berachain-ecosystem-utils';

const LP_TOKEN_WHALE_ADDRESS = '0xe3b9B72ba027FD6c514C0e5BA075Ac9c77C23Afa';
const defaultAccountNumber = ZERO_BI;
const amountWei = parseEther('.5');

enum RewardVaultType {
  Native,
  Infrared,
  BGTM,
}

describe('BGTMIsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: BerachainRewardsRegistry;
  let beraFactory: BerachainRewardsIsolationModeVaultFactory;
  let bgtmFactory: BGTMIsolationModeVaultFactory;

  let underlyingToken: IERC20;
  let bgtmWrapperToken: BGTMERC20Wrapper;

  let beraVault: BerachainRewardsIsolationModeTokenVaultV1;
  let metaVault: BerachainRewardsMetaVault;
  let bgtmVault: BGTMIsolationModeTokenVaultV1;

  let bgtmMarketId: BigNumber;
  let bgtmBal: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 8_627_800,
      network: Network.Berachain,
    });

    bgtmWrapperToken = await createContractWithAbi<BGTMERC20Wrapper>(
      BGTMERC20Wrapper__factory.abi,
      BGTMERC20Wrapper__factory.bytecode,
      [core.berachainRewardsEcosystem.bgtm.address],
    );

    underlyingToken = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset;

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
    const bgtmVaultImplementation = await createBGTMIsolationModeTokenVaultV1();
    bgtmFactory = await createBGTMIsolationModeVaultFactory(registry, bgtmWrapperToken, bgtmVaultImplementation, core);

    await setEtherBalance(core.governance.address, parseEther('100'));
    await core.testEcosystem!.testPriceOracle.setPrice(beraFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, beraFactory, true);

    bgtmMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(bgtmFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, bgtmFactory, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(beraFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(bgtmFactory.address, true);
    await beraFactory.connect(core.governance).ownerInitialize([]);
    await bgtmFactory.connect(core.governance).ownerInitialize([]);
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

    bgtmBal = await bgtmWrapperToken.balanceOf(metaVault.address);
    await expectProtocolBalance(core, bgtmVault, defaultAccountNumber, bgtmMarketId, bgtmBal);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#depositIntoVaultForDolomiteMargin', () => {
    it('should always fail', async () => {
      await expectThrow(
        bgtmVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei),
        'BGTMIsolationModeTokenVaultV1: Not implemented',
      );
    });
  });

  describe('#executeDepositIntoVault', () => {
    it('should work normally (do nothing)', async () => {
      const metaVaultImpersonator = await impersonate(metaVault.address, true);
      await bgtmVault.connect(metaVaultImpersonator).setIsDepositSourceMetaVault(true);
      const bgtmFactoryImpersonator = await impersonate(bgtmFactory.address, true);
      await bgtmVault.connect(bgtmFactoryImpersonator).executeDepositIntoVault(core.hhUser1.address, amountWei);
    });

    it('should fail if isDepositSourceMetaVault is false', async () => {
      const bgtmFactoryImpersonator = await impersonate(bgtmFactory.address, true);
      await expectThrow(
        bgtmVault.connect(bgtmFactoryImpersonator).executeDepositIntoVault(core.hhUser1.address, amountWei),
        'BGTMIsolationModeTokenVaultV1: Only metaVault can deposit',
      );
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        bgtmVault.connect(core.hhUser1).executeDepositIntoVault(core.hhUser1.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeWithdrawalFromVault', () => {
    it('should work normally', async () => {
      await expect(() => bgtmVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, bgtmBal))
        .to.changeTokenBalance(core.tokens.wbera, core.hhUser1.address, bgtmBal);
      await expectProtocolBalance(core, bgtmVault, defaultAccountNumber, bgtmMarketId, ZERO_BI);
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        bgtmVault.connect(core.hhUser1).executeWithdrawalFromVault(core.hhUser1.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#registry', () => {
    it('should work normally', async () => {
      expect(await bgtmVault.registry()).to.equal(registry.address);
    });
  });

  describe('#dolomiteRegistry', () => {
    it('should work normally', async () => {
      expect(await bgtmVault.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });
  });
});
