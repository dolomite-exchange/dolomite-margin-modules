import { DolomiteERC4626, DolomiteERC4626__factory, IERC20 } from '@dolomite-exchange/modules-base/src/types';
import {
  BYTES_EMPTY,
  MAX_UINT_256_BI,
  Network,
  ONE_BI,
  ONE_DAY_SECONDS,
  ONE_ETH_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
  expectThrow,
  expectWalletBalance,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  disableInterestAccrual,
  setupCoreProtocol,
  setupHONEYBalance,
  setupTestMarket,
  setupUserVaultProxy,
  setupWETHBalance,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { defaultAbiCoder, parseEther } from 'ethers/lib/utils';
import { createContractWithAbi, createContractWithLibrary, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  BerachainRewardsMetaVault,
  BerachainRewardsMetaVault__factory,
  BerachainRewardsRegistry,
  DolomiteTokenIsolationModeTokenVaultV1,
  DolomiteTokenIsolationModeTokenVaultV1__factory,
  DolomiteTokenIsolationModeUnwrapperTraderV2,
  DolomiteTokenIsolationModeUnwrapperTraderV2__factory,
  DolomiteTokenIsolationModeVaultFactory,
  DolomiteTokenIsolationModeVaultFactory__factory,
  DolomiteTokenIsolationModeWrapperTraderV2,
  DolomiteTokenIsolationModeWrapperTraderV2__factory,
  InfraredBGTIsolationModeTokenVaultV1,
  InfraredBGTIsolationModeTokenVaultV1__factory,
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
  setupUserMetaVault,
} from './berachain-ecosystem-utils';
import { createDolomiteErc4626Proxy, createIsolationModeTokenVaultV1ActionsImpl, setupNewGenericTraderProxy } from 'packages/base/test/utils/dolomite';
import { BalanceCheckFlag } from '@dolomite-margin/dist/src/types';
import { GenericEventEmissionType, GenericTraderParam, GenericTraderType } from '@dolomite-margin/dist/src/modules/GenericTraderProxyV1';


const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = '123';
const amountWei = parseEther('.1');

const BEX_VAULT_ADDRESS = '0x4Be03f781C497A489E3cB0287833452cA9B9E80B';

describe('DolomiteTokenIsolationModeUnwrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: BerachainRewardsRegistry;
  let factory: DolomiteTokenIsolationModeVaultFactory;

  let dToken: DolomiteERC4626;
  let vault: DolomiteTokenIsolationModeTokenVaultV1;
  let wrapper: DolomiteTokenIsolationModeWrapperTraderV2;
  let unwrapper: DolomiteTokenIsolationModeUnwrapperTraderV2;

  let metaVault: BerachainRewardsMetaVault;
  let parAmount: BigNumber;

  let marketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 837_000,
      network: Network.Berachain,
    });
    await disableInterestAccrual(core, core.marketIds.honey);

    const dTokenProxy = await createDolomiteErc4626Proxy(core.marketIds.honey, core);
    dToken = DolomiteERC4626__factory.connect(dTokenProxy.address, core.hhUser1);

    const metaVaultImplementation = await createContractWithAbi<BerachainRewardsMetaVault>(
      BerachainRewardsMetaVault__factory.abi,
      BerachainRewardsMetaVault__factory.bytecode,
      [],
    );
    registry = await createBerachainRewardsRegistry(core, metaVaultImplementation);

    const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
    const vaultImplementation = await createContractWithLibrary<DolomiteTokenIsolationModeTokenVaultV1>(
      'DolomiteTokenIsolationModeTokenVaultV1',
      libraries,
      [],
    );
    factory = await createContractWithAbi<DolomiteTokenIsolationModeVaultFactory>(
      DolomiteTokenIsolationModeVaultFactory__factory.abi,
      DolomiteTokenIsolationModeVaultFactory__factory.bytecode,
      [registry.address, dToken.address, core.borrowPositionProxyV2.address, vaultImplementation.address, core.dolomiteMargin.address],
    );

    marketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(factory.address, ONE_BI);
    await setupTestMarket(core, factory, true);

    wrapper = await createContractWithAbi<DolomiteTokenIsolationModeWrapperTraderV2>(
      DolomiteTokenIsolationModeWrapperTraderV2__factory.abi,
      DolomiteTokenIsolationModeWrapperTraderV2__factory.bytecode,
      [registry.address, factory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address],
    );
    unwrapper = await createContractWithAbi<DolomiteTokenIsolationModeUnwrapperTraderV2>(
      DolomiteTokenIsolationModeUnwrapperTraderV2__factory.abi,
      DolomiteTokenIsolationModeUnwrapperTraderV2__factory.bytecode,
      [registry.address, factory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address],
    );

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.connect(core.governance).ownerInitialize([wrapper.address, unwrapper.address]);

    await factory.createVault(core.hhUser1.address);
    vault = setupUserVaultProxy<DolomiteTokenIsolationModeTokenVaultV1>(
      await factory.getVaultByAccount(core.hhUser1.address),
      DolomiteTokenIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    metaVault = BerachainRewardsMetaVault__factory.connect(
      await registry.getMetaVaultByAccount(core.hhUser1.address),
      core.hhUser1,
    );

    await setupHONEYBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.honey, amountWei);
    await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.honey, amountWei);
    parAmount = await dToken.balanceOf(core.hhUser1.address);

    // @follow-up Will need to set as global operator or have the metavault set as local operators
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(wrapper.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(unwrapper.address, true);
    await setupNewGenericTraderProxy(core, marketId);

    const wrapperParam: GenericTraderParam = {
      trader: wrapper.address,
      traderType: GenericTraderType.IsolationModeWrapper,
      tradeData: defaultAbiCoder.encode(['uint256'], [2]),
      makerAccountIndex: 0,
    };
    await vault.addCollateralAndSwapExactInputForOutput(
      defaultAccountNumber,
      defaultAccountNumber,
      [core.marketIds.honey, marketId],
      MAX_UINT_256_BI,
      ONE_BI,
      [wrapperParam],
      [{
        owner: metaVault.address,
        number: defaultAccountNumber,
      }],
      {
        deadline: '123123123123123',
        balanceCheckFlag: BalanceCheckFlag.None,
        eventType: GenericEventEmissionType.None,
      },
    );
    await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, parAmount);
    await expectProtocolBalance(core, metaVault, defaultAccountNumber, core.marketIds.honey, amountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#Call and Exchange for non-liquidation sale', () => {
    it('should work when called with the normal conditions', async () => {
      const unwrapperParam: GenericTraderParam = {
        trader: unwrapper.address,
        traderType: GenericTraderType.IsolationModeUnwrapper,
        tradeData: defaultAbiCoder.encode(['uint256'], [2]),
        makerAccountIndex: 0,
      };
      await vault.swapExactInputForOutputAndRemoveCollateral(
        defaultAccountNumber,
        defaultAccountNumber,
        [marketId, core.marketIds.honey],
        MAX_UINT_256_BI,
        ONE_BI,
        [unwrapperParam],
        [{
          owner: metaVault.address,
          number: defaultAccountNumber,
        }],
        {
          deadline: '123123123123123',
          balanceCheckFlag: BalanceCheckFlag.None,
          eventType: GenericEventEmissionType.None,
        },
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.honey, amountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, core.marketIds.honey, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, metaVault, defaultAccountNumber, core.marketIds.honey, ZERO_BI);
      await expectProtocolBalance(core, metaVault, defaultAccountNumber, marketId, ZERO_BI);
    });
  });
});