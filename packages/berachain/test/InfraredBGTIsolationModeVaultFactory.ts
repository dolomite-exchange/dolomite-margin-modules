import { expect } from 'chai';
import {
  IERC20,
} from '@dolomite-exchange/modules-base/src/types';
import { Network, ONE_ETH_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectProtocolBalance, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol, setupTestMarket, setupUserVaultProxy } from '@dolomite-exchange/modules-base/test/utils/setup';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  BerachainRewardsIsolationModeTokenVaultV1,
  BerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsMetavault,
  BerachainRewardsMetavault__factory,
  BerachainRewardsRegistry,
  BGTIsolationModeTokenVaultV1,
  BGTIsolationModeVaultFactory,
  INativeRewardVault,
  InfraredBGTIsolationModeTokenVaultV1,
  InfraredBGTIsolationModeTokenVaultV1__factory,
  InfraredBGTIsolationModeVaultFactory,
  MetavaultOperator,
  MetavaultOperator__factory
} from '../src/types';
import {
  createBerachainRewardsIsolationModeTokenVaultV1,
  createBerachainRewardsIsolationModeVaultFactory,
  createBerachainRewardsRegistry,
  createBGTIsolationModeTokenVaultV1,
  createBGTIsolationModeVaultFactory,
  createInfraredBGTIsolationModeTokenVaultV1,
  createInfraredBGTIsolationModeVaultFactory,
  RewardVaultType,
} from './berachain-ecosystem-utils';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const IBGT_WHALE_ADDRESS = '0x4B95296B937AF613D65206Ba7C203CB9A1263003';
const amountWei = parseEther('.5');
const defaultAccountNumber = ZERO_BI;

describe('InfraredBGTIsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: BerachainRewardsRegistry;
  let beraFactory: BerachainRewardsIsolationModeVaultFactory;
  let otherFactory: BerachainRewardsIsolationModeVaultFactory;
  let bgtFactory: BGTIsolationModeVaultFactory;
  let ibgtFactory: InfraredBGTIsolationModeVaultFactory;

  let underlyingToken: IERC20;
  let otherUnderlyingToken: IERC20;
  let nativeRewardVault: INativeRewardVault;

  let vaultImplementation: BerachainRewardsIsolationModeTokenVaultV1;
  let bgtVaultImplementation: BGTIsolationModeTokenVaultV1;
  let ibgtVaultImplementation: InfraredBGTIsolationModeTokenVaultV1;

  let ibgtMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 4_853_900,
      network: Network.Berachain,
    });

    underlyingToken = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset;
    otherUnderlyingToken = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyWbera.asset;
    nativeRewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.nativeRewardVault;

    const metavaultImplementation = await createContractWithAbi<BerachainRewardsMetavault>(
      BerachainRewardsMetavault__factory.abi,
      BerachainRewardsMetavault__factory.bytecode,
      [],
    );
    const metavaultOperator = await createContractWithAbi<MetavaultOperator>(
      MetavaultOperator__factory.abi,
      MetavaultOperator__factory.bytecode,
      [core.dolomiteMargin.address],
    );
    registry = await createBerachainRewardsRegistry(core, metavaultImplementation, metavaultOperator);
    await registry.connect(core.governance).ownerSetRewardVault(
      underlyingToken.address,
      RewardVaultType.Native,
      nativeRewardVault.address
    );

    vaultImplementation = await createBerachainRewardsIsolationModeTokenVaultV1();
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
    bgtVaultImplementation = await createBGTIsolationModeTokenVaultV1();
    bgtFactory = await createBGTIsolationModeVaultFactory(
      registry,
      core.tokens.bgt,
      bgtVaultImplementation,
      core,
    );
    ibgtVaultImplementation = await createInfraredBGTIsolationModeTokenVaultV1();
    ibgtFactory = await createInfraredBGTIsolationModeVaultFactory(
      registry,
      core.tokens.ibgt,
      ibgtVaultImplementation,
      core,
    );

    ibgtMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(ibgtFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, ibgtFactory, true);

    await core.testEcosystem!.testPriceOracle.setPrice(beraFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, beraFactory, true);

    await core.testEcosystem!.testPriceOracle.setPrice(bgtFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, bgtFactory, true);

    await core.testEcosystem!.testPriceOracle.setPrice(otherFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, otherFactory, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(beraFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(otherFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(bgtFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(ibgtFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(metavaultOperator.address, true);
    await beraFactory.connect(core.governance).ownerInitialize([]);
    await otherFactory.connect(core.governance).ownerInitialize([]);
    await bgtFactory.connect(core.governance).ownerInitialize([]);
    await ibgtFactory.connect(core.governance).ownerInitialize([]);
    await registry.connect(core.governance).ownerSetBgtIsolationModeVaultFactory(bgtFactory.address);
    await registry.connect(core.governance).ownerSetIBgtIsolationModeVaultFactory(ibgtFactory.address);

    const ibgtWhale = await impersonate(IBGT_WHALE_ADDRESS, true);
    await core.tokens.ibgt.connect(ibgtWhale).transfer(core.hhUser1.address, amountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await ibgtFactory.berachainRewardsRegistry()).to.equal(registry.address);
      expect(await ibgtFactory.UNDERLYING_TOKEN()).to.equal(core.tokens.ibgt.address);
      expect(await ibgtFactory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
      expect(await ibgtFactory.userVaultImplementation()).to.equal(ibgtVaultImplementation.address);
      expect(await ibgtFactory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#depositIntoDolomiteMarginFromMetavault', () => {
    it('should work normally', async () => {
      await beraFactory.createVault(core.hhUser1.address);
      const ibgtVault = setupUserVaultProxy<InfraredBGTIsolationModeTokenVaultV1>(
        await ibgtFactory.getVaultByAccount(core.hhUser1.address),
        InfraredBGTIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );
      const metavaultImpersonator = await impersonate(await registry.getAccountToMetavault(core.hhUser1.address), true);
      await core.tokens.ibgt.connect(core.hhUser1).transfer(metavaultImpersonator.address, amountWei);
      await core.tokens.ibgt.connect(metavaultImpersonator).approve(ibgtVault.address, amountWei);

      await ibgtVault.connect(metavaultImpersonator).setIsDepositSourceMetavault(true);
      await ibgtFactory.connect(metavaultImpersonator).depositIntoDolomiteMarginFromMetavault(
        core.hhUser1.address,
        defaultAccountNumber,
        amountWei
      );
      await expectProtocolBalance(core, ibgtVault, defaultAccountNumber, ibgtMarketId, amountWei);
      expect(await ibgtVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await core.berachainRewardsEcosystem.iBgtStakingPool.balanceOf(ibgtVault.address)).to.eq(amountWei);
    });

    it('should fail if not called by owners metavault', async () => {
      await beraFactory.createVault(core.hhUser1.address);
      await expectThrow(
        ibgtFactory.connect(core.hhUser1).depositIntoDolomiteMarginFromMetavault(
          core.hhUser1.address,
          ZERO_BI,
          ONE_ETH_BI
        ),
        'InfraredBGTIsolationVaultFactory: Can only deposit from metavault'
      );
    });
  });

  describe('#ownerSetBerachainRewardsRegistry', () => {
    it('should work normally', async () => {
      const result = await ibgtFactory.connect(core.governance).ownerSetBerachainRewardsRegistry(OTHER_ADDRESS);
      await expectEvent(ibgtFactory, result, 'BerachainRewardsRegistrySet', {
        berachainRewardsRegistry: OTHER_ADDRESS,
      });
      expect(await ibgtFactory.berachainRewardsRegistry()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        ibgtFactory.connect(core.hhUser1).ownerSetBerachainRewardsRegistry(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#allowableCollateralMarketIds', () => {
    it('should work normally', async () => {
      expect(await ibgtFactory.allowableCollateralMarketIds()).to.deep.equal([]);
    });
  });

  describe('#allowableDebtMarketIds', () => {
    it('should work normally', async () => {
      expect(await ibgtFactory.allowableDebtMarketIds()).to.deep.equal([]);
    });
  });
});
