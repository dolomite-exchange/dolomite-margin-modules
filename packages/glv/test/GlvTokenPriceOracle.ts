import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { mine } from '@nomicfoundation/hardhat-network-helpers';
import { setNextBlockTimestamp } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectThrow } from 'packages/base/test/utils/assertions';
import { createDolomiteRegistryImplementation } from 'packages/base/test/utils/dolomite';
import {
  getDefaultProtocolConfigForGlv,
  setupCoreProtocol,
  setupTestMarket,
} from 'packages/base/test/utils/setup';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  GlvIsolationModeUnwrapperTraderV2,
  GlvIsolationModeVaultFactory,
  GlvIsolationModeWrapperTraderV2,
  GlvRegistry,
  GlvTokenPriceOracle,
  IGlvToken
} from '../src/types';
import { IGmxMarketToken } from 'packages/gmx-v2/src/types';
import {
  createGlvIsolationModeTokenVaultV1,
  createGlvIsolationModeUnwrapperTraderV2,
  createGlvIsolationModeVaultFactory,
  createGlvIsolationModeWrapperTraderV2,
  createGlvLibrary,
  createGlvRegistry,
  createGlvTokenPriceOracle,
  setupNewOracleAggregatorTokens
} from './glv-ecosystem-utils';
import { createGmxV2Library } from 'packages/gmx-v2/test/gmx-v2-ecosystem-utils';
import { GMX_V2_EXECUTION_FEE_FOR_TESTS } from 'packages/gmx-v2/src/gmx-v2-constructors';

const GLV_ETH_USD_PRICE = BigNumber.from('977453876271351641'); // $.977
const FEE_BASIS_POINTS = BigNumber.from('7');
const NEXT_TIMESTAMP = 1_726_000_000;

const executionFee =
  process.env.COVERAGE !== 'true' ? GMX_V2_EXECUTION_FEE_FOR_TESTS : GMX_V2_EXECUTION_FEE_FOR_TESTS.mul(10);
const callbackGasLimit =
  process.env.COVERAGE !== 'true' ? BigNumber.from('3000000') : BigNumber.from('3000000').mul(10);

describe('GlvTokenPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: IGlvToken;
  let gmMarketToken: IGmxMarketToken;
  let allowableMarketIds: BigNumberish[];
  let glvPriceOracle: GlvTokenPriceOracle;
  let glvRegistry: GlvRegistry;
  let factory: GlvIsolationModeVaultFactory;
  let wrapper: GlvIsolationModeWrapperTraderV2;
  let unwrapper: GlvIsolationModeUnwrapperTraderV2;
  let marketId: BigNumberish;

  before(async () => {
    core = await setupCoreProtocol(getDefaultProtocolConfigForGlv());
    underlyingToken = core.glvEcosystem.glvTokens.wethUsdc.glvToken.connect(core.hhUser1);
    gmMarketToken = core.gmxV2Ecosystem.gmTokens.ethUsd.marketToken;

    await setupNewOracleAggregatorTokens(core);

    const glvLibrary = await createGlvLibrary();
    const gmxV2Library = await createGmxV2Library();
    glvRegistry = await createGlvRegistry(core, gmMarketToken, callbackGasLimit);
    const newRegistry = await createDolomiteRegistryImplementation();
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(newRegistry.address);

    const userVaultImplementation = await createGlvIsolationModeTokenVaultV1(core, glvLibrary, gmxV2Library);

    allowableMarketIds = [core.marketIds.nativeUsdc, core.marketIds.weth];
    factory = await createGlvIsolationModeVaultFactory(
      core,
      gmxV2Library,
      glvRegistry,
      allowableMarketIds,
      allowableMarketIds,
      core.glvEcosystem.glvTokens.wethUsdc,
      userVaultImplementation,
      executionFee,
    );
    unwrapper = await createGlvIsolationModeUnwrapperTraderV2(core, factory, glvLibrary, gmxV2Library, glvRegistry);
    wrapper = await createGlvIsolationModeWrapperTraderV2(core, factory, glvLibrary, gmxV2Library, glvRegistry);

    glvPriceOracle = await createGlvTokenPriceOracle(core, factory, glvRegistry);

    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, glvPriceOracle);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    await glvRegistry.connect(core.governance).ownerSetUnwrapperByToken(factory.address, unwrapper.address);
    await glvRegistry.connect(core.governance).ownerSetWrapperByToken(factory.address, wrapper.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await glvPriceOracle.REGISTRY()).to.eq(glvRegistry.address);
      expect(await glvPriceOracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });
  });

  describe('#getFeeBpByMarketToken', () => {
    it('should work normally', async () => {
      expect(await glvPriceOracle.getFeeBpByMarketToken(gmMarketToken.address)).to.eq(
        FEE_BASIS_POINTS,
      );
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value', async () => {
      // Have to be at specific timestamp to get consistent price
      await setNextBlockTimestamp(NEXT_TIMESTAMP);
      await mine();
      expect((await glvPriceOracle.getPrice(factory.address)).value).to.eq(GLV_ETH_USD_PRICE);
    });

    it('should fail when token sent is not a valid token', async () => {
      await expectThrow(
        glvPriceOracle.getPrice(ADDRESSES.ZERO),
        `GlvTokenPriceOracle: Invalid token <${ADDRESSES.ZERO}>`,
      );
      await expectThrow(
        glvPriceOracle.getPrice(core.tokens.usdc.address),
        `GlvTokenPriceOracle: Invalid token <${core.tokens.usdc.address.toLowerCase()}>`,
      );
    });

    it('should fail when GM token is borrowable', async () => {
      await core.dolomiteMargin.ownerSetIsClosing(marketId, false);
      await expectThrow(
        glvPriceOracle.getPrice(factory.address),
        'GlvTokenPriceOracle: glvToken cannot be borrowable',
      );
    });
  });
});
