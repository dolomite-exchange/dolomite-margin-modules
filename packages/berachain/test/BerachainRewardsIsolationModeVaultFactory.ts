import { expect } from 'chai';
import {
  IERC20,
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2,
} from '@dolomite-exchange/modules-base/src/types';
import { Network, ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol, setupTestMarket } from '@dolomite-exchange/modules-base/test/utils/setup';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  BerachainRewardsIsolationModeTokenVaultV1,
  BerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsMetavault,
  BerachainRewardsMetavault__factory,
  BerachainRewardsRegistry,
  IBeraRewardVault,
  MetavaultOperator,
  MetavaultOperator__factory
} from '../src/types';
import {
  createBerachainRewardsIsolationModeTokenVaultV1,
  createBerachainRewardsIsolationModeVaultFactory,
  createBerachainRewardsRegistry,
  createBerachainRewardsUnwrapperTraderV2,
  createBerachainRewardsWrapperTraderV2
} from './berachain-ecosystem-utils';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';

describe('BerachainRewardsIsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let beraRegistry: BerachainRewardsRegistry;
  let unwrapper: SimpleIsolationModeUnwrapperTraderV2;
  let wrapper: SimpleIsolationModeWrapperTraderV2;
  let beraFactory: BerachainRewardsIsolationModeVaultFactory;
  let otherFactory: BerachainRewardsIsolationModeVaultFactory;
  let vaultImplementation: BerachainRewardsIsolationModeTokenVaultV1;
  let underlyingToken: IERC20;
  let otherUnderlyingToken: IERC20;
  let rewardVault: IBeraRewardVault;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 4_853_900,
      network: Network.Berachain,
    });

    underlyingToken = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset;
    otherUnderlyingToken = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyWbera.asset;
    rewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.nativeRewardVault;

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
    beraRegistry = await createBerachainRewardsRegistry(core, metavaultImplementation, metavaultOperator);

    vaultImplementation = await createBerachainRewardsIsolationModeTokenVaultV1();
    beraFactory = await createBerachainRewardsIsolationModeVaultFactory(
      beraRegistry,
      underlyingToken,
      vaultImplementation,
      core
    );

    otherFactory = await createBerachainRewardsIsolationModeVaultFactory(
      beraRegistry,
      otherUnderlyingToken,
      vaultImplementation,
      core
    );

    unwrapper = await createBerachainRewardsUnwrapperTraderV2(beraFactory, core);
    wrapper = await createBerachainRewardsWrapperTraderV2(beraFactory, core);

    await core.testEcosystem!.testPriceOracle.setPrice(beraFactory.address, ONE_ETH_BI);
    await core.testEcosystem!.testPriceOracle.setPrice(otherFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, beraFactory, true);
    await setupTestMarket(core, otherFactory, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(beraFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(otherFactory.address, true);
    await beraFactory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await otherFactory.connect(core.governance).ownerInitialize([]);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await beraFactory.berachainRewardsRegistry()).to.equal(beraRegistry.address);
      expect(await beraFactory.UNDERLYING_TOKEN()).to.equal(underlyingToken.address);
      expect(await beraFactory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
      expect(await beraFactory.userVaultImplementation()).to.equal(vaultImplementation.address);
      expect(await beraFactory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#createVault', () => {
    it('should create metavault if it does not exist', async () => {
      const metavaultAddress = await beraRegistry.calculateMetavaultByAccount(core.hhUser1.address);
      const res = await beraFactory.createVault(core.hhUser1.address);
      await expectEvent(beraRegistry, res, 'MetavaultCreated', {
        account: core.hhUser1.address,
        metavault: metavaultAddress,
      });
    });

    it('should not create metavault if it already exists', async () => {
      await beraFactory.createVault(core.hhUser1.address);
      await expect(otherFactory.createVault(core.hhUser1.address)).to.not.emit(beraRegistry, 'MetavaultCreated');
    });
  });

  describe('#ownerSetBerachainRewardsRegistry', () => {
    it('should work normally', async () => {
      const result = await beraFactory.connect(core.governance).ownerSetBerachainRewardsRegistry(OTHER_ADDRESS);
      await expectEvent(beraFactory, result, 'BerachainRewardsRegistrySet', {
        berachainRewardsRegistry: OTHER_ADDRESS,
      });
      expect(await beraFactory.berachainRewardsRegistry()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        beraFactory.connect(core.hhUser1).ownerSetBerachainRewardsRegistry(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#allowableCollateralMarketIds', () => {
    it('should work normally', async () => {
      expect(await beraFactory.allowableCollateralMarketIds()).to.deep.equal([]);
    });
  });

  describe('#allowableDebtMarketIds', () => {
    it('should work normally', async () => {
      expect(await beraFactory.allowableDebtMarketIds()).to.deep.equal([]);
    });
  });
});
