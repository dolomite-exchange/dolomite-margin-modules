import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  JonesUSDCIsolationModeTokenVaultV1,
  JonesUSDCIsolationModeVaultFactory,
  JonesUSDCRegistry,
  TestGLPIsolationModeTokenVaultV1,
  TestGLPIsolationModeTokenVaultV1__factory,
} from '../../../../src/types';
import { createContractWithAbi } from '../../../../packages/base/src/utils/dolomite-utils';
import { Network } from '../../../../packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../../../packages/base/test/utils';
import { expectEvent, expectThrow } from '../../../../packages/base/test/utils/assertions';
import {
  createJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation,
  createJonesUSDCIsolationModeUnwrapperTraderV2ForZap,
  createJonesUSDCIsolationModeVaultFactory,
  createJonesUSDCIsolationModeWrapperTraderV2,
  createJonesUSDCPriceOracle,
  createJonesUSDCRegistry,
} from '../../../utils/ecosystem-token-utils/jones';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol, setupTestMarket } from '../../../../packages/base/test/utils/setup';
import { createRoleAndWhitelistTrader } from './jones-utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('JonesUSDCIsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let jonesUSDCRegistry: JonesUSDCRegistry;
  let vaultImplementation: TestGLPIsolationModeTokenVaultV1;
  let factory: JonesUSDCIsolationModeVaultFactory;
  let underlyingMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    jonesUSDCRegistry = await createJonesUSDCRegistry(core);
    vaultImplementation = await createContractWithAbi<TestGLPIsolationModeTokenVaultV1>(
      TestGLPIsolationModeTokenVaultV1__factory.abi,
      TestGLPIsolationModeTokenVaultV1__factory.bytecode,
      [],
    );
    factory = await createJonesUSDCIsolationModeVaultFactory(
      core,
      jonesUSDCRegistry,
      core.jonesEcosystem!.jUSDC,
      (vaultImplementation as any) as JonesUSDCIsolationModeTokenVaultV1,
    );

    const unwrapperTraderForLiquidation = await createJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation(
      core,
      jonesUSDCRegistry,
      factory,
    );
    const unwrapperTraderForZap = await createJonesUSDCIsolationModeUnwrapperTraderV2ForZap(
      core,
      jonesUSDCRegistry,
      factory,
    );
    await jonesUSDCRegistry.initializeUnwrapperTraders(
      unwrapperTraderForLiquidation.address,
      unwrapperTraderForZap.address,
    );
    const wrapper = await createJonesUSDCIsolationModeWrapperTraderV2(core, jonesUSDCRegistry, factory);
    await createRoleAndWhitelistTrader(core, unwrapperTraderForLiquidation, wrapper);
    const priceOracle = await createJonesUSDCPriceOracle(core, jonesUSDCRegistry, factory);

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);
    await core.dolomiteMargin.ownerSetPriceOracle(underlyingMarketId, priceOracle.address);

    await factory.connect(core.governance).ownerInitialize([unwrapperTraderForLiquidation.address, wrapper.address]);
    await factory.connect(core.governance).ownerSetAllowableCollateralMarketIds([underlyingMarketId]);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await factory.jonesUSDCRegistry()).to.equal(jonesUSDCRegistry.address);
      expect(await factory.UNDERLYING_TOKEN()).to.equal(core.jonesEcosystem!.jUSDC.address);
      expect(await factory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
      expect(await factory.userVaultImplementation()).to.equal(vaultImplementation.address);
      expect(await factory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#ownerSetJonesUSDCRegistry', () => {
    it('should work normally', async () => {
      const result = await factory.connect(core.governance).ownerSetJonesUSDCRegistry(OTHER_ADDRESS);
      await expectEvent(factory, result, 'JonesUSDCRegistrySet', {
        jonesUSDCRegistry: OTHER_ADDRESS,
      });
      expect(await factory.jonesUSDCRegistry()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).ownerSetJonesUSDCRegistry(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#allowableCollateralMarketIds', () => {
    it('should work normally', async () => {
      const result = await factory.allowableCollateralMarketIds();
      expect(result.length).to.eql(1);
      expect(result[0]).to.eq(underlyingMarketId);
    });
  });

  describe('#allowableDebtMarketIds', () => {
    it('should work normally', async () => {
      const result = await factory.allowableDebtMarketIds();
      expect(result.length).to.eql(1);
      expect(result[0].toNumber()).to.eq(core.marketIds.usdc);
    });
  });
});
