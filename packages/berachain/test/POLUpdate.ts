import { MAX_UINT_256_BI, Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import {
  setupCoreProtocol,
  setupRUsdBalance,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { defaultAbiCoder, parseEther } from 'ethers/lib/utils';
import { createContractWithAbi, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { expectProtocolBalance, expectThrow } from 'packages/base/test/utils/assertions';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  BerachainRewardsRegistry,
  IInfraredVault__factory,
  InfraredBGTMetaVaultV2,
  InfraredBGTMetaVaultV2__factory,
  POLIsolationModeTokenVaultV1,
  POLIsolationModeTokenVaultV1__factory,
  POLIsolationModeVaultFactory,
  POLIsolationModeVaultFactory__factory,
} from '../src/types';
import {
  createPOLIsolationModeTokenVaultV1,
  RewardVaultType,
} from './berachain-ecosystem-utils';
import { GenericEventEmissionType, GenericTraderParam, GenericTraderType } from '@dolomite-margin/dist/src/modules/GenericTraderProxyV1';
import { BalanceCheckFlag } from '@dolomite-margin/dist/src/types';

const defaultAccountNumber = ZERO_BI;
const amount = parseEther('80000');

describe('POLUpdate', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let vaultImplementation: POLIsolationModeTokenVaultV1;
  let polFactory: POLIsolationModeVaultFactory;
  let registry: BerachainRewardsRegistry;

  let metavaultImplementationV2: InfraredBGTMetaVaultV2;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 5_586_862,
      network: Network.Berachain,
    });

    vaultImplementation = await createPOLIsolationModeTokenVaultV1();
    polFactory = POLIsolationModeVaultFactory__factory.connect(
      '0x5DB5ef3D657471d991e4de09983D2c92b0609749',
      core.hhUser1
    );
    registry = core.berachainRewardsEcosystem.live.registry;

    metavaultImplementationV2 = await createContractWithAbi<InfraredBGTMetaVaultV2>(
      InfraredBGTMetaVaultV2__factory.abi,
      InfraredBGTMetaVaultV2__factory.bytecode,
      [core.dolomiteMargin.address],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#test', () => {
    it('should no longer work through router to deposit', async () => {
      await setupRUsdBalance(core, core.hhUser1, amount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.rUsd, amount);

      await core.dolomiteMargin.connect(core.governance).ownerSetPriceOracle(39, core.oracleAggregatorV2.address);
      await core.berachainRewardsEcosystem.live.registry.connect(core.governance).ownerSetPolTokenVault(
        vaultImplementation.address
      );

      await core.dolomiteTokens.rUsd.connect(core.hhUser1).approve(core.depositWithdrawalRouter.address, ONE_ETH_BI);
      await expectThrow(
        core.depositWithdrawalRouter.connect(core.hhUser1).depositWei(
          39,
          defaultAccountNumber,
          39,
          ONE_ETH_BI,
          0,
        ),
        'Can only zap into POL vault',
      );
    });

    it('should no longer work through router to withdraw', async () => {
      await setupRUsdBalance(core, core.hhUser1, amount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.rUsd, amount);

      await core.dolomiteMargin.connect(core.governance).ownerSetPriceOracle(39, core.oracleAggregatorV2.address);
      await core.dolomiteTokens.rUsd.connect(core.hhUser1).approve(core.depositWithdrawalRouter.address, ONE_ETH_BI);
      await core.depositWithdrawalRouter.connect(core.hhUser1).depositWei(
        39,
        defaultAccountNumber,
        39,
        ONE_ETH_BI,
        0,
      );

      const vaultImplementation = await createPOLIsolationModeTokenVaultV1();
      await core.berachainRewardsEcosystem.live.registry.connect(core.governance).ownerSetPolTokenVault(
        vaultImplementation.address
      );

      await expectThrow(
        core.depositWithdrawalRouter.connect(core.hhUser1).withdrawWei(
          39,
          defaultAccountNumber,
          39,
          ONE_ETH_BI,
          0,
        ),
        'Can only zap out of POL vault',
      );
    });

    it('should have correct balance', async () => {
      const user = '0x2c1259a2C764dCc66241edFbdFD281AfcB6d870A';
      const vault = await polFactory.getVaultByAccount(user);
      const metavault = await core.berachainRewardsEcosystem.live.registry.getMetaVaultByAccount(user);

      const infraredVault = IInfraredVault__factory.connect(
        await registry.rewardVault(core.dolomiteTokens.rUsd.address, RewardVaultType.Infrared),
        core.hhUser1,
      );
      const metavaultPar = await core.dolomiteMargin.getAccountPar(
        { owner: metavault, number: defaultAccountNumber },
        core.marketIds.rUsd
      );
      const vaultPar = await core.dolomiteMargin.getAccountPar({ owner: vault, number: defaultAccountNumber }, 39);
      expect(metavaultPar.value).to.eq(ZERO_BI);
      expect(await infraredVault.balanceOf(metavault)).to.eq(vaultPar.value);
    });

    it('should transfer funds to metavault', async () => {
      await setupRUsdBalance(core, core.hhUser1, amount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.rUsd, amount);

      const user = await impersonate('0x62dFA6eBA6a34E55c454894dd9b3E688F88CB09b', true);
      const accountNumber = BigNumber.from('44976727696018895331746976563377652501904371332622590265514825582226055111404');
      const vault = await polFactory.getVaultByAccount(user.address);
      const metavault = await core.berachainRewardsEcosystem.live.registry.getMetaVaultByAccount(user.address);

      const par = await core.dolomiteMargin.getAccountPar({ owner: vault, number: accountNumber }, 39);
      await core.dolomiteTokens.rUsd.connect(core.hhUser1).transfer(metavault, par.value, { gasLimit: 10_000_000 });

      const polVault = POLIsolationModeTokenVaultV1__factory.connect(vault, user);
      await core.dolomiteMargin.connect(core.governance).ownerSetPriceOracle(39, core.oracleAggregatorV2.address);
      await polVault.transferFromPositionWithUnderlyingToken(
        accountNumber,
        defaultAccountNumber,
        par.value
      );

      const unwrapperParam: GenericTraderParam = {
        trader: '0x645004487aE442049efFD66b1A09EcB8d5274b1C',
        traderType: GenericTraderType.IsolationModeUnwrapper,
        tradeData: defaultAbiCoder.encode(['uint256'], [2]),
        makerAccountIndex: 0,
      };
      let userPar = await core.dolomiteMargin.getAccountPar(
        { owner: user.address, number: defaultAccountNumber },
        core.marketIds.rUsd
      );
      console.log(userPar.value);
      await polVault.swapExactInputForOutputAndRemoveCollateral(
        defaultAccountNumber,
        defaultAccountNumber,
        [39, core.marketIds.rUsd],
        MAX_UINT_256_BI,
        ONE_BI,
        [unwrapperParam],
        [
          {
            owner: metavault,
            number: defaultAccountNumber,
          },
        ],
        {
          deadline: '123123123123123',
          balanceCheckFlag: BalanceCheckFlag.None,
          eventType: GenericEventEmissionType.None,
        },
        { gasLimit: 15_000_000 },
      );

      userPar = await core.dolomiteMargin.getAccountPar(
        { owner: user.address, number: defaultAccountNumber },
        core.marketIds.rUsd
      );
      console.log(userPar.value);
    });
  });

  describe('#ownerStakeDolomiteToken', () => {
    it('should work normally', async () => {
      // test that we can correct user's accounting
      await setupRUsdBalance(core, core.hhUser1, amount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.rUsd, amount);

      await core.berachainRewardsEcosystem.live.registry.connect(core.governance).ownerSetMetaVaultImplementation(
        metavaultImplementationV2.address
      );

      const user = await impersonate('0x62dFA6eBA6a34E55c454894dd9b3E688F88CB09b', true);
      const accountNumber = BigNumber.from('44976727696018895331746976563377652501904371332622590265514825582226055111404');
      const polVault = POLIsolationModeTokenVaultV1__factory.connect(
        await polFactory.getVaultByAccount(user.address),
        user
      );
      const metavault = InfraredBGTMetaVaultV2__factory.connect(
        await core.berachainRewardsEcosystem.live.registry.getMetaVaultByAccount(user.address),
        user
      );

      const par = await core.dolomiteMargin.getAccountPar({ owner: polVault.address, number: accountNumber }, 39);
      await core.dolomiteTokens.rUsd.connect(core.hhUser1).transfer(
        metavault.address,
        par.value,
        { gasLimit: 10_000_000 }
      );
      await metavault.connect(core.governance).ownerStakeDolomiteToken(
        core.dolomiteTokens.rUsd.address,
        RewardVaultType.Infrared,
        par.value
      );
      await expectProtocolBalance(core, polVault.address, accountNumber, 39, par.value);
      await expectProtocolBalance(core, metavault, defaultAccountNumber, core.marketIds.rUsd, 0);
      const infraredVault = IInfraredVault__factory.connect(
        await core.berachainRewardsEcosystem.live.registry.rewardVault(
          core.dolomiteTokens.rUsd.address,
          RewardVaultType.Infrared
        ),
        core.hhUser1,
      );
      expect(await infraredVault.balanceOf(metavault.address)).to.eq(par.value);
      expect(await polVault.underlyingBalanceOf()).to.eq(par.value);

      // Test can user withdraw
      await core.dolomiteMargin.connect(core.governance).ownerSetPriceOracle(39, core.oracleAggregatorV2.address);
      await polVault.transferFromPositionWithUnderlyingToken(
        accountNumber,
        defaultAccountNumber,
        par.value
      );

      const unwrapperParam: GenericTraderParam = {
        trader: '0x645004487aE442049efFD66b1A09EcB8d5274b1C',
        traderType: GenericTraderType.IsolationModeUnwrapper,
        tradeData: defaultAbiCoder.encode(['uint256'], [2]),
        makerAccountIndex: 0,
      };
      let userPar = await core.dolomiteMargin.getAccountPar(
        { owner: user.address, number: defaultAccountNumber },
        core.marketIds.rUsd
      );
      await polVault.swapExactInputForOutputAndRemoveCollateral(
        defaultAccountNumber,
        defaultAccountNumber,
        [39, core.marketIds.rUsd],
        MAX_UINT_256_BI,
        ONE_BI,
        [unwrapperParam],
        [
          {
            owner: metavault.address,
            number: defaultAccountNumber,
          },
        ],
        {
          deadline: '123123123123123',
          balanceCheckFlag: BalanceCheckFlag.None,
          eventType: GenericEventEmissionType.None,
        },
        { gasLimit: 15_000_000 },
      );

      userPar = await core.dolomiteMargin.getAccountPar(
        { owner: user.address, number: defaultAccountNumber },
        core.marketIds.rUsd
      );
    });
  });
});
