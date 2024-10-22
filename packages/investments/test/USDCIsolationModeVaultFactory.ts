import { expect } from 'chai';
import { USDCIsolationModeTokenVaultV1, USDCIsolationModeVaultFactory, USDCRegistry, } from '../src/types';
import {
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2,
} from '@dolomite-exchange/modules-base/src/types';
import { DEFAULT_BLOCK_NUMBER, Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol, setupTestMarket } from '@dolomite-exchange/modules-base/test/utils/setup';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  createUSDCIsolationModeTokenVaultV1,
  createUSDCIsolationModeVaultFactory,
  createUSDCRegistry,
  createUSDCUnwrapperTraderV2,
  createUSDCWrapperTraderV2
} from './usdc-ecosystem-utils';
import { BigNumber } from 'ethers';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const usdcPrice = BigNumber.from('1000000000000000000000000000000');

describe('USDCIsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let usdcRegistry: USDCRegistry;
  let unwrapper: SimpleIsolationModeUnwrapperTraderV2;
  let wrapper: SimpleIsolationModeWrapperTraderV2;
  let usdcFactory: USDCIsolationModeVaultFactory;
  let vaultImplementation: USDCIsolationModeTokenVaultV1;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: DEFAULT_BLOCK_NUMBER,
      network: Network.ArbitrumOne,
    });

    usdcRegistry = await createUSDCRegistry(core);

    vaultImplementation = await createUSDCIsolationModeTokenVaultV1();
    usdcFactory = await createUSDCIsolationModeVaultFactory(usdcRegistry, vaultImplementation, core);

    unwrapper = await createUSDCUnwrapperTraderV2(usdcFactory, core);
    wrapper = await createUSDCWrapperTraderV2(usdcFactory, core);

    await core.testEcosystem?.testPriceOracle.setPrice(usdcFactory.address, usdcPrice);
    await setupTestMarket(core, usdcFactory, true, core.testEcosystem!.testPriceOracle);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(usdcFactory.address, true);
    await usdcFactory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    await usdcFactory.createVault(core.hhUser1.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await usdcFactory.usdcRegistry()).to.equal(usdcRegistry.address);
      expect(await usdcFactory.UNDERLYING_TOKEN()).to.equal(core.tokens.nativeUsdc!.address);
      expect(await usdcFactory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
      expect(await usdcFactory.userVaultImplementation()).to.equal(vaultImplementation.address);
      expect(await usdcFactory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#ownerSetUSDCRegistry', () => {
    it('should work normally', async () => {
      const result = await usdcFactory.connect(core.governance).ownerSetUSDCRegistry(OTHER_ADDRESS);
      await expectEvent(usdcFactory, result, 'USDCRegistrySet', {
        usdcRegistry: OTHER_ADDRESS,
      });
      expect(await usdcFactory.usdcRegistry()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        usdcFactory.connect(core.hhUser1).ownerSetUSDCRegistry(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#allowableCollateralMarketIds', () => {
    it('should work normally', async () => {
      expect(await usdcFactory.allowableCollateralMarketIds()).to.deep.equal([]);
    });
  });

  describe('#allowableDebtMarketIds', () => {
    it('should work normally', async () => {
      expect(await usdcFactory.allowableDebtMarketIds()).to.deep.equal([]);
    });
  });
});
