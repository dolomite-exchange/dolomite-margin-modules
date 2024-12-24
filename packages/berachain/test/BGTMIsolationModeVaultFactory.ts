import { IERC20 } from '@dolomite-exchange/modules-base/src/types';
import {
  Network,
  ONE_DAY_SECONDS,
  ONE_ETH_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectProtocolBalance, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
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
  RewardVaultType,
} from './berachain-ecosystem-utils';

const LP_TOKEN_WHALE_ADDRESS = '0x1293DA55eC372a94368Fa20E8DF69FaBc3320baE';
const amountWei = parseEther('.5');
const defaultAccountNumber = ZERO_BI;

describe('BGTMIsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: BerachainRewardsRegistry;
  let beraFactory: BerachainRewardsIsolationModeVaultFactory;
  let bgtmFactory: BGTMIsolationModeVaultFactory;

  let underlyingToken: IERC20;
  let bgtmWrapperToken: BGTMERC20Wrapper;

  let vaultImplementation: BerachainRewardsIsolationModeTokenVaultV1;
  let bgtmVaultImplementation: BGTMIsolationModeTokenVaultV1;

  let bgtmMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 4_853_900,
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

    vaultImplementation = await createBerachainRewardsIsolationModeTokenVaultV1();
    beraFactory = await createBerachainRewardsIsolationModeVaultFactory(
      registry,
      underlyingToken,
      vaultImplementation,
      core,
    );
    bgtmVaultImplementation = await createBGTMIsolationModeTokenVaultV1();
    bgtmFactory = await createBGTMIsolationModeVaultFactory(registry, bgtmWrapperToken, bgtmVaultImplementation, core);

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

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await bgtmFactory.berachainRewardsRegistry()).to.equal(registry.address);
      expect(await bgtmFactory.UNDERLYING_TOKEN()).to.equal(bgtmWrapperToken.address);
      expect(await bgtmFactory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
      expect(await bgtmFactory.userVaultImplementation()).to.equal(bgtmVaultImplementation.address);
      expect(await bgtmFactory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#depositIntoDolomiteMarginFromMetaVault', () => {
    it('should work normally', async () => {
      await beraFactory.createVault(core.hhUser1.address);
      const beraVault = setupUserVaultProxy<BerachainRewardsIsolationModeTokenVaultV1>(
        await beraFactory.getVaultByAccount(core.hhUser1.address),
        BerachainRewardsIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );
      const metaVault = BerachainRewardsMetaVault__factory.connect(
        await registry.getMetaVaultByAccount(core.hhUser1.address),
        core.hhUser1,
      );

      const lpWhale = await impersonate(LP_TOKEN_WHALE_ADDRESS);
      await underlyingToken.connect(lpWhale).transfer(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(beraVault.address, amountWei);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.BGTM);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      const balance = await metaVault.callStatic.getReward(underlyingToken.address);
      await metaVault.getReward(underlyingToken.address);

      const bgtmVault = setupUserVaultProxy<BGTMIsolationModeTokenVaultV1>(
        await bgtmFactory.getVaultByAccount(core.hhUser1.address),
        BGTMIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );
      await expectProtocolBalance(core, bgtmVault, defaultAccountNumber, bgtmMarketId, balance);
    });

    it('should fail if not called by owners metaVault', async () => {
      await beraFactory.createVault(core.hhUser1.address);
      await expectThrow(
        bgtmFactory
          .connect(core.hhUser1)
          .depositIntoDolomiteMarginFromMetaVault(core.hhUser1.address, ZERO_BI, ONE_ETH_BI),
        'MetaVaultRewardReceiverFactory: Can only deposit from metaVault',
      );
    });
  });

  describe('#allowableCollateralMarketIds', () => {
    it('should work normally', async () => {
      expect(await bgtmFactory.allowableCollateralMarketIds()).to.deep.equal([
        BigNumber.from(core.marketIds.wbera),
        bgtmMarketId,
      ]);
    });
  });

  describe('#allowableDebtMarketIds', () => {
    it('should work normally', async () => {
      expect(await bgtmFactory.allowableDebtMarketIds()).to.deep.equal([BigNumber.from(core.marketIds.wbera)]);
    });
  });
});
