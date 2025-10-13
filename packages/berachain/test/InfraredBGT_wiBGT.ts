import { Network, ONE_ETH_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import {
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
  expectWalletBalance,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  setupCoreProtocol,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  BerachainRewardsRegistry,
  BerachainRewardsRegistry__factory,
  InfraredBGTIsolationModeTokenVaultV1,
  InfraredBGTIsolationModeTokenVaultV1__factory,
  InfraredBGTIsolationModeVaultFactory,
  InfraredBGTIsolationModeVaultFactory__factory,
  InfraredBGTMetaVault,
  InfraredBGTMetaVault__factory,
} from '../src/types';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';

const IBGT_WHALE_ADDRESS = '0x9b45388Fc442343dE9959D710eB47Da8c09eE2d9';
const defaultAccountNumber = ZERO_BI;
const amountWei = parseEther('.5');

describe('InfraredBGT_wiBGT', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: BerachainRewardsRegistry;
  let iBgtFactory: InfraredBGTIsolationModeVaultFactory;

  let iBgtVault: InfraredBGTIsolationModeTokenVaultV1;
  let iBgtMarketId: BigNumber;
  let iBgtWhale: SignerWithAddressWithSafety;
  let metaVault: InfraredBGTMetaVault;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 11_738_600,
      network: Network.Berachain,
    });

    registry = core.berachainRewardsEcosystem.live.registry;
    iBgtFactory = InfraredBGTIsolationModeVaultFactory__factory.connect(
      core.tokens.diBgt.address,
      core.hhUser1
    );
    iBgtMarketId = BigNumber.from(core.marketIds.diBgt);

    const metaVaultImplementation = await createContractWithAbi<InfraredBGTMetaVault>(
      InfraredBGTMetaVault__factory.abi,
      InfraredBGTMetaVault__factory.bytecode,
      [],
    );
    const registryImplementation = await createContractWithAbi<BerachainRewardsRegistry>(
      BerachainRewardsRegistry__factory.abi,
      BerachainRewardsRegistry__factory.bytecode,
      [],
    );
    await core.berachainRewardsEcosystem.live.registryProxy.connect(core.governance).upgradeTo(
      registryImplementation.address
    );
    await registry.connect(core.governance).ownerSetMetaVaultImplementation(metaVaultImplementation.address);

    await iBgtFactory.createVault(core.hhUser1.address);
    iBgtVault = setupUserVaultProxy<InfraredBGTIsolationModeTokenVaultV1>(
      await iBgtFactory.getVaultByAccount(core.hhUser1.address),
      InfraredBGTIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    metaVault = InfraredBGTMetaVault__factory.connect(
      await registry.getMetaVaultByVault(iBgtVault.address),
      core.hhUser1,
    );
    await registry.connect(core.governance).ownerSetWiBgt(core.tokens.wiBgt.address);

    iBgtWhale = await impersonate(IBGT_WHALE_ADDRESS, true);
    await core.tokens.iBgt.connect(iBgtWhale).transfer(core.hhUser1.address, amountWei);
    await core.tokens.iBgt.connect(core.hhUser1).approve(iBgtVault.address, amountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#getReward', () => {
    it('should work normally with no airdrop', async () => {
      await iBgtVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, amountWei);

      await increase(60);
      const wiBgtAmount = await core.berachainRewardsEcosystem.iBgtStakingPool.earned(
        metaVault.address,
        core.tokens.wiBgt.address
      );
      await iBgtVault.getReward({ gasLimit: 5000000 });

      await expectWalletBalance(iBgtVault, core.tokens.iBgt, ZERO_BI);
      await expectWalletBalance(metaVault, core.tokens.iBgt, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: iBgtVault.address, number: defaultAccountNumber },
        iBgtMarketId,
        amountWei.add(wiBgtAmount),
        0,
      );
    });

    it('should work normally with airdrop', async () => {
      await iBgtVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, amountWei);

      await core.tokens.iBgt.connect(iBgtWhale).transfer(metaVault.address, ONE_ETH_BI);

      await increase(60);
      const wiBgtAmount = await core.berachainRewardsEcosystem.iBgtStakingPool.earned(
        metaVault.address,
        core.tokens.wiBgt.address
      );
      await iBgtVault.getReward({ gasLimit: 5000000 });

      await expectWalletBalance(iBgtVault, core.tokens.iBgt, ZERO_BI);
      await expectWalletBalance(metaVault, core.tokens.iBgt, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: iBgtVault.address, number: defaultAccountNumber },
        iBgtMarketId,
        amountWei.add(wiBgtAmount).add(ONE_ETH_BI),
        0,
      );
    });
  });
});
