import { MAX_UINT_256_BI, Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import {
  setupCoreProtocol,
  setupRUsdBalance,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { defaultAbiCoder, formatEther, parseEther } from 'ethers/lib/utils';
import { createContractWithAbi, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { expectProtocolBalance, expectThrow } from 'packages/base/test/utils/assertions';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  BerachainRewardsRegistry,
  IInfraredVault,
  IInfraredVault__factory,
  InfraredBGTMetaVaultWithOwnerStake,
  InfraredBGTMetaVaultWithOwnerStake__factory,
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
import { POLBalanceMapping } from './POLBalanceMapping';

const defaultAccountNumber = ZERO_BI;
const amount = parseEther('1700000'); // 1.7 million rUsd. More than needed

describe('POLUpdate', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let vaultImplementation: POLIsolationModeTokenVaultV1;
  let polFactory: POLIsolationModeVaultFactory;
  let registry: BerachainRewardsRegistry;
  let rusdInfraredVault: IInfraredVault;

  let metavaultImplementationV2: InfraredBGTMetaVaultWithOwnerStake;

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
    rusdInfraredVault = IInfraredVault__factory.connect(
      await registry.rewardVault(core.dolomiteTokens.rUsd.address, RewardVaultType.Infrared),
      core.hhUser1,
    );

    metavaultImplementationV2 = await createContractWithAbi<InfraredBGTMetaVaultWithOwnerStake>(
      InfraredBGTMetaVaultWithOwnerStake__factory.abi,
      InfraredBGTMetaVaultWithOwnerStake__factory.bytecode,
      [core.dolomiteMargin.address],
    );

    // update POL vault, metavault, and unpause
    await core.berachainRewardsEcosystem.live.registry.connect(core.governance).ownerSetPolTokenVault(
      vaultImplementation.address
    );
    await core.berachainRewardsEcosystem.live.registry.connect(core.governance).ownerSetMetaVaultImplementation(
      metavaultImplementationV2.address
    );
    await core.dolomiteMargin.connect(core.governance).ownerSetPriceOracle(39, core.oracleAggregatorV2.address);

    // set up gnosis safe rUsd balance and deposit to Dolomite
    await setupRUsdBalance(core, core.gnosisSafe, amount, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.gnosisSafe, defaultAccountNumber, core.marketIds.rUsd, amount);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#POLBalanceMapping', () => {
    it.only('should have correct balance, total supply, and missing amount', async () => {
      const totalSupply = await polFactory.totalSupply();
      let totalSupplySum = BigNumber.from(0);
      let missingPolAmount = BigNumber.from(0);

      for (const user of Object.keys(POLBalanceMapping)) {
        const userInfo = POLBalanceMapping[user];
        const vault = await polFactory.getVaultByAccount(user);
        expect(await registry.getMetaVaultByAccount(user)).to.eq(userInfo.metaVault);

        await expectProtocolBalance(core, vault, userInfo.accountNumber, 39, userInfo.polAmount);
        expect(await core.dolomiteTokens.rUsd.balanceOf(userInfo.metaVault)).to.eq(userInfo.drUsdMetaVaultBalance);
        expect(await rusdInfraredVault.balanceOf(userInfo.metaVault)).to.eq(userInfo.metaVaultStakedBalance);

        if (userInfo.drUsdMetaVaultBalance.eq(ZERO_BI) && userInfo.metaVaultStakedBalance.eq(ZERO_BI)) {
          missingPolAmount = missingPolAmount.add(userInfo.polAmount);
        }

        totalSupplySum = totalSupplySum.add(POLBalanceMapping[user].polAmount);
      }

      console.log('missingPolAmount: ', formatEther(missingPolAmount));
      console.log('totalSupply: ', formatEther(totalSupply));
      expect(totalSupplySum.eq(totalSupply)).to.be.true;
    });

    it('should correctly transfer funds to metavault, stake, and unwrap', async () => {
      // loop through each user
      console.log('--------------------------------');
      for (const user of Object.keys(POLBalanceMapping)) {
        const userInfo = POLBalanceMapping[user];
        const vault = POLIsolationModeTokenVaultV1__factory.connect(
          await polFactory.getVaultByAccount(user),
          core.hhUser1
        );
        const metavault = InfraredBGTMetaVaultWithOwnerStake__factory.connect(
          await core.berachainRewardsEcosystem.live.registry.getMetaVaultByAccount(user),
          core.hhUser1
        );

        if (!userInfo.polAmount.eq(userInfo.metaVaultStakedBalance)) {
          // transfer funds to metavault and stake
          await core.dolomiteTokens.rUsd.connect(core.gnosisSafe).transfer(
            metavault.address,
            userInfo.polAmount,
            { gasLimit: 10_000_000 }
          );
          await metavault.connect(core.governance).ownerStakeDolomiteToken(
            core.dolomiteTokens.rUsd.address,
            RewardVaultType.Infrared,
            userInfo.polAmount,
            { gasLimit: 15_000_000 }
          );
          expect(await core.dolomiteTokens.rUsd.balanceOf(metavault.address)).to.eq(ZERO_BI);
          expect(await rusdInfraredVault.balanceOf(metavault.address)).to.eq(userInfo.polAmount);

          // unwrap
          const unwrapperParam: GenericTraderParam = {
            trader: '0x645004487aE442049efFD66b1A09EcB8d5274b1C',
            traderType: GenericTraderType.IsolationModeUnwrapper,
            tradeData: defaultAbiCoder.encode(['uint256'], [2]),
            makerAccountIndex: 0,
          };
          const impersonatedUser = await impersonate(user, true);
          console.log('user: ', user);
          console.log('polAmount (rUsd par): ', formatEther(userInfo.polAmount));
          if (userInfo.accountNumber.eq(ZERO_BI)) {
            await vault.connect(impersonatedUser).swapExactInputForOutputAndRemoveCollateral(
              userInfo.accountNumber,
              userInfo.accountNumber,
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
            const rUsdBal = await core.dolomiteMargin.getAccountWei(
              { owner: user, number: userInfo.accountNumber },
              core.marketIds.rUsd
            );
            console.log('rUsd bal post unwrap (wei): ', formatEther(rUsdBal.value));
          } else {
            await vault.connect(impersonatedUser).swapExactInputForOutput(
              userInfo.accountNumber,
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
            const rUsdBal = await core.dolomiteMargin.getAccountWei(
              { owner: vault.address, number: userInfo.accountNumber },
              core.marketIds.rUsd
            );
            console.log('rUsd bal post unwrap (wei): ', formatEther(rUsdBal.value));
          }
          console.log('--------------------------------');
          await expectProtocolBalance(core, vault, userInfo.accountNumber, 39, ZERO_BI);
        }
      }
    });
  });

  describe('#codeUpdates', () => {
    it('should no longer work through router to deposit', async () => {
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
      const user = await impersonate('0x2c1259a2C764dCc66241edFbdFD281AfcB6d870A', true);
      await expectThrow(
        core.depositWithdrawalRouter.connect(user).withdrawWei(
          39,
          defaultAccountNumber,
          39,
          ONE_BI,
          0,
        ),
        'Can only zap out of POL vault',
      );
    });
  });
});
