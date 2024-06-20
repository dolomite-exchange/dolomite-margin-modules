import { expect } from 'chai';
import { ARBIsolationModeTokenVaultV1, ARBIsolationModeVaultFactory, ARBRegistry, } from '../src/types';
import {
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2,
} from '@dolomite-exchange/modules-base/src/types';
import { ADDRESS_ZERO, Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  createARBIsolationModeTokenVaultV1,
  createARBIsolationModeVaultFactory,
  createARBRegistry,
  createARBUnwrapperTraderV2,
  createARBWrapperTraderV2,
} from './arb-ecosystem-utils';
import { setupCoreProtocol, setupTestMarket } from '@dolomite-exchange/modules-base/test/utils/setup';
import { DEFAULT_BLOCK_NUMBER_FOR_ARB_TESTS } from './arb-utils';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('ARBIsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let arbRegistry: ARBRegistry;
  let unwrapper: SimpleIsolationModeUnwrapperTraderV2;
  let wrapper: SimpleIsolationModeWrapperTraderV2;
  let arbFactory: ARBIsolationModeVaultFactory;
  let vaultImplementation: ARBIsolationModeTokenVaultV1;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: DEFAULT_BLOCK_NUMBER_FOR_ARB_TESTS,
      network: Network.ArbitrumOne,
    });

    arbRegistry = await createARBRegistry(core);

    vaultImplementation = await createARBIsolationModeTokenVaultV1();
    arbFactory = await createARBIsolationModeVaultFactory(arbRegistry, vaultImplementation, core);

    unwrapper = await createARBUnwrapperTraderV2(arbFactory, core);
    wrapper = await createARBWrapperTraderV2(arbFactory, core);
    await core.chainlinkPriceOracleV1!.connect(core.governance).ownerInsertOrUpdateOracleToken(
      arbFactory.address,
      await arbFactory.decimals(),
      await core.chainlinkPriceOracleV1!.getAggregatorByToken(core.tokens.arb!.address),
      ADDRESS_ZERO,
    );

    await setupTestMarket(core, arbFactory, true, core.chainlinkPriceOracleV1);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(arbFactory.address, true);
    await arbFactory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    await arbFactory.createVault(core.hhUser1.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await arbFactory.arbRegistry()).to.equal(arbRegistry.address);
      expect(await arbFactory.UNDERLYING_TOKEN()).to.equal(core.tokens.arb!.address);
      expect(await arbFactory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
      expect(await arbFactory.userVaultImplementation()).to.equal(vaultImplementation.address);
      expect(await arbFactory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#setARBRegistry', () => {
    it('should work normally', async () => {
      const result = await arbFactory.connect(core.governance).setARBRegistry(OTHER_ADDRESS);
      await expectEvent(arbFactory, result, 'ARBRegistrySet', {
        arbRegistry: OTHER_ADDRESS,
      });
      expect(await arbFactory.arbRegistry()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        arbFactory.connect(core.hhUser1).setARBRegistry(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#allowableCollateralMarketIds', () => {
    it('should work normally', async () => {
      expect(await arbFactory.allowableCollateralMarketIds()).to.deep.equal([]);
    });
  });

  describe('#allowableDebtMarketIds', () => {
    it('should work normally', async () => {
      expect(await arbFactory.allowableDebtMarketIds()).to.deep.equal([]);
    });
  });
});
