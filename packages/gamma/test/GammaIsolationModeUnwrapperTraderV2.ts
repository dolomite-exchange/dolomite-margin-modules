import { expect } from 'chai';
import { BYTES_EMPTY, MAX_UINT_256_BI, Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectProtocolBalance, expectProtocolBalanceIsGreaterThan, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol, setupNativeUSDCBalance, setupTestMarket, setupUserVaultProxy, setupWETHBalance } from '@dolomite-exchange/modules-base/test/utils/setup';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  GammaIsolationModeTokenVaultV1,
  GammaIsolationModeTokenVaultV1__factory,
  GammaIsolationModeUnwrapperTraderV2,
  GammaIsolationModeVaultFactory,
  GammaIsolationModeWrapperTraderV2,
  GammaPoolPriceOracle,
  GammaRegistry,
  IGammaPool
} from '../src/types';
import {
  createGammaIsolationModeTokenVaultV1,
  createGammaIsolationModeVaultFactory,
  createGammaPoolPriceOracle,
  createGammaRegistry,
  createGammaUnwrapperTraderV2,
  createGammaWrapperTraderV2,
  getUnwrappingParams
} from './gamma-ecosystem-utils';
import { BigNumber, ethers } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { AccountInfoStruct } from 'packages/base/src/utils';
import { createOdosAggregatorTrader } from 'packages/base/test/utils/ecosystem-utils/traders';
import { getCalldataForOdos } from 'packages/base/test/utils/trader-utils';
import { DolomiteRegistryImplementation, DolomiteRegistryImplementation__factory, OdosAggregatorTrader, TestAggregatorTrader, TestAggregatorTrader__factory } from 'packages/base/src/types';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { createDolomiteAccountRegistryImplementation, createRegistryProxy } from 'packages/base/test/utils/dolomite';

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const usdcAmount = BigNumber.from('1000000000'); // $1,000
const wethAmount = parseEther('.25');

describe('GammaIsolationModeUnwrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let gammaPool: IGammaPool;
  let gammaRegistry: GammaRegistry;
  let unwrapper: GammaIsolationModeUnwrapperTraderV2;
  let wrapper: GammaIsolationModeWrapperTraderV2;
  let gammaFactory: GammaIsolationModeVaultFactory;
  let vault: GammaIsolationModeTokenVaultV1;
  let gammaOracle: GammaPoolPriceOracle;
  let defaultAccount: AccountInfoStruct;
  let borrowAccount: AccountInfoStruct;
  let amountWei: BigNumber;
  let marketId: BigNumber;
  let odosAggregator: OdosAggregatorTrader;
  let testAggregator: TestAggregatorTrader;

  before(async () => {
    core = await setupCoreProtocol({
      // blockNumber: await getRealLatestBlockNumber(true, Network.ArbitrumOne),
      blockNumber: 213_000_000,
      network: Network.ArbitrumOne,
    });

    odosAggregator = await createOdosAggregatorTrader(core);
    testAggregator = await createContractWithAbi<TestAggregatorTrader>(
      TestAggregatorTrader__factory.abi,
      TestAggregatorTrader__factory.bytecode,
      [core.dolomiteMargin.address]
    );

    gammaRegistry = await createGammaRegistry(core);
    gammaPool = core.gammaEcosystem.gammaPools.wethUsdc;

    const vaultImplementation = await createGammaIsolationModeTokenVaultV1();
    gammaFactory = await createGammaIsolationModeVaultFactory(gammaRegistry, gammaPool, vaultImplementation, core);

    const dolomiteAccountRegistry = await createDolomiteAccountRegistryImplementation();
    const calldata = await dolomiteAccountRegistry.populateTransaction.initialize(
      [gammaFactory.address],
    );
    const accountRegistryProxy = await createRegistryProxy(dolomiteAccountRegistry.address, calldata.data!, core);
    const dolomiteRegistryImplementation = await createContractWithAbi<DolomiteRegistryImplementation>(
      DolomiteRegistryImplementation__factory.abi,
      DolomiteRegistryImplementation__factory.bytecode,
      [],
    );

    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(dolomiteRegistryImplementation.address);
    await core.dolomiteRegistry.connect(core.governance).ownerSetDolomiteAccountRegistry(accountRegistryProxy.address);

    unwrapper = await createGammaUnwrapperTraderV2(core, gammaFactory, gammaRegistry);
    wrapper = await createGammaWrapperTraderV2(core, gammaFactory, gammaRegistry);
    gammaOracle = await createGammaPoolPriceOracle(core, gammaRegistry);
    await gammaOracle.connect(core.governance).ownerSetGammaPool(gammaFactory.address, true);

    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, gammaFactory, true, gammaOracle);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(gammaFactory.address, true);
    await gammaFactory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    await gammaFactory.createVault(core.hhUser1.address);
    vault = setupUserVaultProxy<GammaIsolationModeTokenVaultV1>(
      await gammaFactory.getVaultByAccount(core.hhUser1.address),
      GammaIsolationModeTokenVaultV1__factory,
      core.hhUser1
    );
    defaultAccount = { owner: vault.address, number: defaultAccountNumber };
    borrowAccount = { owner: vault.address, number: borrowAccountNumber };

    await setupNativeUSDCBalance(core, core.hhUser1, usdcAmount.mul(2), core.gammaEcosystem.positionManager);
    await setupWETHBalance(core, core.hhUser1, wethAmount.mul(2), core.gammaEcosystem.positionManager);
    await core.gammaEcosystem.positionManager.connect(core.hhUser1).depositReserves({
      protocolId: await gammaPool.protocolId(),
      cfmm: await gammaPool.cfmm(),
      to: core.hhUser1.address,
      deadline: MAX_UINT_256_BI,
      amountsDesired: [wethAmount, usdcAmount],
      amountsMin: [0, 0],
    });
    amountWei = await gammaPool.balanceOf(core.hhUser1.address);
    console.log(amountWei.toString());

    await gammaPool.connect(core.hhUser1).approve(vault.address, amountWei);
    await vault.depositIntoVaultForDolomiteMargin(ZERO_BI, amountWei);

    expect(await gammaPool.balanceOf(vault.address)).gt(ZERO_BI);
    expect(await gammaPool.balanceOf(vault.address)).to.equal(amountWei);
    expect((await core.dolomiteMargin.getAccountWei(defaultAccount, marketId)).value).to.equal(amountWei);

    await core.tokens.nativeUsdc.connect(core.hhUser1).transfer(testAggregator.address, usdcAmount);
    await core.tokens.weth.connect(core.hhUser1).transfer(testAggregator.address, wethAmount);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await unwrapper.GAMMA_REGISTRY()).to.equal(gammaRegistry.address);
      expect(await unwrapper.GAMMA_POOL()).to.equal(gammaPool.address);
      expect(await unwrapper.DELTA_SWAP_PAIR()).to.equal(await gammaPool.cfmm());
    });
  });

  describe('#exchange', () => {
    xit('should work normally with token0 and odos', async () => {
      const { calldata } = await getCalldataForOdos(
        usdcAmount,
        core.tokens.nativeUsdc,
        6,
        ONE_BI,
        core.tokens.weth,
        18,
        unwrapper,
        core
      );
      const odosOrderData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [
          ONE_BI,
          calldata,
        ],
      );
      await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei);
      const unwrappingParams = getUnwrappingParams(
        borrowAccountNumber,
        marketId,
        amountWei,
        core.marketIds.weth,
        ONE_BI,
        unwrapper,
        odosAggregator,
        odosOrderData
      );
      await vault.swapExactInputForOutput(
        borrowAccountNumber,
        unwrappingParams.marketPath,
        amountWei,
        unwrappingParams.minAmountOut,
        unwrappingParams.traderParams,
        unwrappingParams.makerAccounts,
        unwrappingParams.userConfig
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(core, borrowAccount, core.marketIds.weth, wethAmount, 0);
    });

    xit('should work normally with token1 and odos', async () => {
      const { calldata } = await getCalldataForOdos(
        wethAmount,
        core.tokens.weth,
        18,
        ONE_BI,
        core.tokens.nativeUsdc,
        6,
        unwrapper,
        core
      );
      const odosOrderData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [
          ONE_BI,
          calldata,
        ],
      );
      await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei);
      const unwrappingParams = getUnwrappingParams(
        borrowAccountNumber,
        marketId,
        amountWei,
        core.marketIds.nativeUsdc,
        ONE_BI,
        unwrapper,
        odosAggregator,
        odosOrderData
      );
      await vault.swapExactInputForOutput(
        borrowAccountNumber,
        unwrappingParams.marketPath,
        amountWei,
        unwrappingParams.minAmountOut,
        unwrappingParams.traderParams,
        unwrappingParams.makerAccounts,
        unwrappingParams.userConfig
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(core, borrowAccount, core.marketIds.nativeUsdc, usdcAmount, 0);
    });

    it('should work normally with token0', async () => {
      await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei);
      const unwrappingParams = getUnwrappingParams(
        borrowAccountNumber,
        marketId,
        amountWei,
        core.marketIds.weth,
        ONE_BI,
        unwrapper,
        testAggregator,
        ethers.utils.defaultAbiCoder.encode(['uint256', 'bytes'], [parseEther('.1'), BYTES_EMPTY])
      );
      await vault.swapExactInputForOutput(
        borrowAccountNumber,
        unwrappingParams.marketPath,
        amountWei,
        unwrappingParams.minAmountOut,
        unwrappingParams.traderParams,
        unwrappingParams.makerAccounts,
        unwrappingParams.userConfig
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        borrowAccount,
        core.marketIds.weth,
        wethAmount.add(parseEther('.1')),
        ZERO_BI
      );
    });

    it('should work normally with token1', async () => {
      await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei);
      const unwrappingParams = getUnwrappingParams(
        borrowAccountNumber,
        marketId,
        amountWei,
        core.marketIds.nativeUsdc,
        ONE_BI,
        unwrapper,
        testAggregator,
        ethers.utils.defaultAbiCoder.encode(['uint256', 'bytes'], [usdcAmount, BYTES_EMPTY])
      );
      await vault.swapExactInputForOutput(
        borrowAccountNumber,
        unwrappingParams.marketPath,
        amountWei,
        unwrappingParams.minAmountOut,
        unwrappingParams.traderParams,
        unwrappingParams.makerAccounts,
        unwrappingParams.userConfig
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(core, borrowAccount, core.marketIds.nativeUsdc, usdcAmount, 0);
    });
  });

  describe('#isValidOutputToken', () => {
    it('should return true for either pool token', async () => {
      expect(await unwrapper.isValidOutputToken(core.tokens.weth.address)).to.be.true;
      expect(await unwrapper.isValidOutputToken(core.tokens.nativeUsdc.address)).to.be.true;
    });

    it('should return false for an invalid token', async () => {
      expect(await unwrapper.isValidOutputToken(core.tokens.dai.address)).to.be.false;
    });
  });

  describe('#getExchangeCost', () => {
    it('should fail because it is not implemented', async () => {
      await expectThrow(
        unwrapper.getExchangeCost(gammaFactory.address, core.tokens.nativeUsdc.address, ONE_ETH_BI, BYTES_EMPTY),
        'GammaUnwrapperTraderV2: getExchangeCost is not implemented',
      );
    });
  });
});
