import { expect } from 'chai';
import {
  IERC20,
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2,
} from '@dolomite-exchange/modules-base/src/types';
import { ADDRESS_ZERO, Network, ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol, setupTestMarket } from '@dolomite-exchange/modules-base/test/utils/setup';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { BerachainRewardsIsolationModeTokenVaultV1, BerachainRewardsIsolationModeVaultFactory, BerachainRewardsRegistry, IERC20__factory } from '../src/types';
import { createBerachainRewardsIsolationModeTokenVaultV1, createBerachainRewardsIsolationModeVaultFactory, createBerachainRewardsRegistry, createBerachainRewardsUnwrapperTraderV2, createBerachainRewardsWrapperTraderV2 } from './berachain-ecosystem-utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const HONEY_USDC_LP_TOKEN = '0xD69ADb6FB5fD6D06E6ceEc5405D95A37F96E3b96';
const LP_TOKEN_WHALE_ADDRESS = '0x1293DA55eC372a94368Fa20E8DF69FaBc3320baE';

describe('BerachainRewardsIsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let beraRegistry: BerachainRewardsRegistry;
  let unwrapper: SimpleIsolationModeUnwrapperTraderV2;
  let wrapper: SimpleIsolationModeWrapperTraderV2;
  let beraFactory: BerachainRewardsIsolationModeVaultFactory;
  let vaultImplementation: BerachainRewardsIsolationModeTokenVaultV1;
  let underlyingToken: IERC20;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 4_853_900,
      network: Network.Berachain,
    });

    beraRegistry = await createBerachainRewardsRegistry(core);
    underlyingToken = IERC20__factory.connect(HONEY_USDC_LP_TOKEN, core.hhUser1);
    const lpWhale = await impersonate(LP_TOKEN_WHALE_ADDRESS);
    await underlyingToken.connect(lpWhale).transfer(core.hhUser1.address, ONE_ETH_BI);

    vaultImplementation = await createBerachainRewardsIsolationModeTokenVaultV1();
    beraFactory = await createBerachainRewardsIsolationModeVaultFactory(beraRegistry, underlyingToken, vaultImplementation, core);

    unwrapper = await createBerachainRewardsUnwrapperTraderV2(beraFactory, core);
    wrapper = await createBerachainRewardsWrapperTraderV2(beraFactory, core);

    await core.testEcosystem!.testPriceOracle.setPrice(beraFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, beraFactory, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(beraFactory.address, true);
    await beraFactory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    await beraFactory.createVault(core.hhUser1.address);

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
