import { expect } from 'chai';
import { MAX_UINT_256_BI, Network, ONE_ETH_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
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
  createGammaWrapperTraderV2
} from './gamma-ecosystem-utils';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { AccountInfoStruct } from 'packages/base/src/utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const defaultAccountNumber = '0';
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
  let amountWei: BigNumber;
  let marketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 213_000_000,
      network: Network.ArbitrumOne,
    });

    gammaRegistry = await createGammaRegistry(core);
    gammaPool = core.gammaEcosystem.gammaPools.wethUsdc;

    const vaultImplementation = await createGammaIsolationModeTokenVaultV1();
    gammaFactory = await createGammaIsolationModeVaultFactory(gammaRegistry, gammaPool, vaultImplementation, core);

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

    await setupNativeUSDCBalance(core, core.hhUser1, usdcAmount, core.gammaEcosystem.positionManager);
    await setupWETHBalance(core, core.hhUser1, wethAmount, core.gammaEcosystem.positionManager);
    await core.gammaEcosystem.positionManager.connect(core.hhUser1).depositReserves({
      protocolId: await gammaPool.protocolId(),
      cfmm: await gammaPool.cfmm(),
      to: core.hhUser1.address,
      deadline: MAX_UINT_256_BI,
      amountsDesired: [wethAmount, usdcAmount],
      amountsMin: [0, 0],
    });
    amountWei = await gammaPool.balanceOf(core.hhUser1.address);

    await gammaPool.connect(core.hhUser1).approve(vault.address, amountWei);
    await vault.depositIntoVaultForDolomiteMargin(ZERO_BI, amountWei);

    expect(await gammaPool.balanceOf(vault.address)).gt(ZERO_BI);
    expect(await gammaPool.balanceOf(vault.address)).to.equal(amountWei);
    expect((await core.dolomiteMargin.getAccountWei(defaultAccount, marketId)).value).to.equal(amountWei);

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

  describe('#isValidOutputToken', () => {
    it('should return true for either pool token', async () => {
      expect(await unwrapper.isValidOutputToken(core.tokens.weth.address)).to.be.true;
      expect(await unwrapper.isValidOutputToken(core.tokens.nativeUsdc.address)).to.be.true;
    });

    it('should return false for an invalid token', async () => {
      expect(await unwrapper.isValidOutputToken(core.tokens.dai.address)).to.be.false;
    });
  });
});
