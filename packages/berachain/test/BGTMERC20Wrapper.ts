import { IERC20 } from '@dolomite-exchange/modules-base/src/types';
import {
  Network,
  ONE_DAY_SECONDS,
  ONE_ETH_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, setEtherBalance, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expect } from 'chai';
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
  BGTIsolationModeVaultFactory,
  BGTMERC20Wrapper,
  BGTMERC20Wrapper__factory,
  BGTMIsolationModeVaultFactory,
} from '../src/types';
import {
  createBerachainRewardsIsolationModeTokenVaultV1,
  createBerachainRewardsIsolationModeVaultFactory,
  createBerachainRewardsRegistry,
  createBGTIsolationModeTokenVaultV1,
  createBGTIsolationModeVaultFactory,
  createBGTMIsolationModeTokenVaultV1,
  createBGTMIsolationModeVaultFactory,
  RewardVaultType,
} from './berachain-ecosystem-utils';

const LP_TOKEN_WHALE_ADDRESS = '0xe3b9B72ba027FD6c514C0e5BA075Ac9c77C23Afa';
const defaultAccountNumber = ZERO_BI;
const amountWei = parseEther('.5');

xdescribe('BGTMERC20Wrapper', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: BerachainRewardsRegistry;
  let beraFactory: BerachainRewardsIsolationModeVaultFactory;
  let bgtFactory: BGTIsolationModeVaultFactory;
  let bgtmFactory: BGTMIsolationModeVaultFactory;

  let underlyingToken: IERC20;
  let bgtmWrapper: BGTMERC20Wrapper;

  let beraVault: BerachainRewardsIsolationModeTokenVaultV1;
  let metaVault: BerachainRewardsMetaVault;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 8_627_800,
      network: Network.Berachain,
    });

    bgtmWrapper = await createContractWithAbi<BGTMERC20Wrapper>(
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
    const bgtVaultImplementation = await createBGTIsolationModeTokenVaultV1();
    bgtFactory = await createBGTIsolationModeVaultFactory(registry, core.tokens.bgt, bgtVaultImplementation, core);

    const bgtmVaultImplementation = await createBGTMIsolationModeTokenVaultV1();
    bgtmFactory = await createBGTMIsolationModeVaultFactory(registry, bgtmWrapper, bgtmVaultImplementation, core);

    await setEtherBalance(core.governance.address, parseEther('100'));
    await core.testEcosystem!.testPriceOracle.setPrice(beraFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, beraFactory, true);

    await core.testEcosystem!.testPriceOracle.setPrice(bgtFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, bgtFactory, true);

    await core.testEcosystem!.testPriceOracle.setPrice(bgtmFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, bgtmFactory, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(beraFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(bgtFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(bgtmFactory.address, true);
    await beraFactory.connect(core.governance).ownerInitialize([]);
    await bgtFactory.connect(core.governance).ownerInitialize([]);
    await bgtmFactory.connect(core.governance).ownerInitialize([]);
    await registry.connect(core.governance).ownerSetBgtIsolationModeVaultFactory(bgtFactory.address);
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

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should construct correctly', async () => {
      expect(await bgtmWrapper.bgtm()).to.equal(core.berachainRewardsEcosystem.bgtm.address);
      expect(await bgtmWrapper.name()).to.equal('BGT Market');
      expect(await bgtmWrapper.symbol()).to.equal('BGT.m');
      expect(await bgtmWrapper.decimals()).to.equal(18);
    });
  });

  describe('#balanceOf', () => {
    it('should work normally', async () => {
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.BGTM);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      const bal = await metaVault.callStatic.getReward(underlyingToken.address);

      expect(await bgtmWrapper.balanceOf(metaVault.address)).to.equal(ZERO_BI);
      expect(await core.berachainRewardsEcosystem.bgtm.getBalance(metaVault.address)).to.equal(ZERO_BI);
      await metaVault.getReward(underlyingToken.address);
      expect(await core.berachainRewardsEcosystem.bgtm.getBalance(metaVault.address)).to.equal(bal);
      expect(await bgtmWrapper.balanceOf(metaVault.address)).to.equal(bal);
    });
  });

  describe('#transfer', () => {
    it('should fail', async () => {
      await expectThrow(bgtmWrapper.transfer(core.hhUser2.address, amountWei), 'Not implemented');
    });
  });

  describe('#approve', () => {
    it('should fail', async () => {
      await expectThrow(bgtmWrapper.approve(core.hhUser2.address, amountWei), 'Not implemented');
    });
  });

  describe('#transferFrom', () => {
    it('should fail', async () => {
      await expectThrow(
        bgtmWrapper.transferFrom(core.hhUser2.address, core.hhUser1.address, amountWei),
        'Not implemented',
      );
    });
  });

  describe('#totalSupply', () => {
    it('should fail', async () => {
      await expectThrow(bgtmWrapper.totalSupply(), 'Not implemented');
    });
  });

  describe('#allowance', () => {
    it('should fail', async () => {
      await expectThrow(bgtmWrapper.allowance(core.hhUser2.address, core.hhUser1.address), 'Not implemented');
    });
  });
});
