import { BigNumber, BigNumberish } from 'ethers';
import {
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
  GmxRegistryV2,
  GmxV2IsolationModeTokenVaultV1,
  GmxV2IsolationModeTokenVaultV1__factory,
  GmxV2IsolationModeTokenVaultV1Library,
  GmxV2IsolationModeTokenVaultV1Library__factory,
  GmxV2IsolationModeUnwrapperTraderV2,
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeWrapperTraderV2,
  IGmxMarketToken,
  IsolationModeFreezableLiquidatorProxy,
  IsolationModeFreezableLiquidatorProxy__factory,
} from '../../../src/types';
import { AccountStruct } from '../../../src/utils/constants';
import {
  createContractWithAbi,
  createContractWithLibrary,
  depositIntoDolomiteMargin,
} from '../../../src/utils/dolomite-utils';
import { Network, NO_EXPIRY, ONE_BI, ONE_ETH_BI, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { increaseByTimeDelta, revertToSnapshotAndCapture, snapshot } from '../../utils';
import {
  createGmxRegistryV2,
  createGmxV2IsolationModeUnwrapperTraderV2,
  createGmxV2IsolationModeVaultFactory,
  createGmxV2IsolationModeWrapperTraderV2,
} from '../../utils/ecosystem-token-utils/gmx';
import { setExpiry } from '../../utils/expiry-utils';
import {
  CoreProtocol,
  disableInterestAccrual,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
  setupWETHBalance,
} from '../../utils/setup';

const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = defaultAccountNumber.add(ONE_BI);
const callbackGasLimit = BigNumber.from('1500000');

const wethAmount = ONE_ETH_BI; // 1 ETH
const usdcAmount = BigNumber.from('1888000000'); // 1,888
const amountWei = ONE_ETH_BI.mul('1234'); // 1,234

describe('IsolationModeFreezableLiquidatorProxy', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IGmxMarketToken;
  let gmxRegistryV2: GmxRegistryV2;
  let allowableMarketIds: BigNumberish[];
  let unwrapper: GmxV2IsolationModeUnwrapperTraderV2;
  let wrapper: GmxV2IsolationModeWrapperTraderV2;
  let factory: GmxV2IsolationModeVaultFactory;
  let vault: GmxV2IsolationModeTokenVaultV1;
  let marketId: BigNumber;
  let liquidator: IsolationModeFreezableLiquidatorProxy;

  let liquidAccount: AccountStruct;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));

    const newImplementation = await createContractWithAbi<DolomiteRegistryImplementation>(
      DolomiteRegistryImplementation__factory.abi,
      DolomiteRegistryImplementation__factory.bytecode,
      [],
    );
    await core.dolomiteRegistryProxy.upgradeTo(newImplementation.address);

    liquidator = await createContractWithAbi<IsolationModeFreezableLiquidatorProxy>(
      IsolationModeFreezableLiquidatorProxy__factory.abi,
      IsolationModeFreezableLiquidatorProxy__factory.bytecode,
      [core.dolomiteRegistry, core.dolomiteMargin.address, core.expiry.address, core.liquidatorAssetRegistry.address],
    );

    underlyingToken = core.gmxEcosystemV2!.gmxEthUsdMarketToken.connect(core.hhUser1);
    const library = await createContractWithAbi<GmxV2IsolationModeTokenVaultV1Library>(
      GmxV2IsolationModeTokenVaultV1Library__factory.abi,
      GmxV2IsolationModeTokenVaultV1Library__factory.bytecode,
      [],
    );
    const userVaultImplementation = await createContractWithLibrary<GmxV2IsolationModeTokenVaultV1>(
      'GmxV2IsolationModeTokenVaultV1',
      { GmxV2IsolationModeTokenVaultV1Library: library.address },
      [core.tokens.weth.address],
    );
    gmxRegistryV2 = await createGmxRegistryV2(core);

    allowableMarketIds = [core.marketIds.nativeUsdc!, core.marketIds.weth];
    factory = await createGmxV2IsolationModeVaultFactory(
      core,
      gmxRegistryV2,
      allowableMarketIds,
      allowableMarketIds,
      core.gmxEcosystemV2!.gmxEthUsdMarketToken,
      userVaultImplementation,
    );
    unwrapper = await createGmxV2IsolationModeUnwrapperTraderV2(core, factory, gmxRegistryV2);
    wrapper = await createGmxV2IsolationModeWrapperTraderV2(core, factory, gmxRegistryV2);
    await gmxRegistryV2.connect(core.governance).ownerSetGmxV2UnwrapperTrader(unwrapper.address);
    await gmxRegistryV2.connect(core.governance).ownerSetGmxV2WrapperTrader(wrapper.address);

    // Use actual price oracle later
    await core.testEcosystem!.testPriceOracle!.setPrice(factory.address, '1000000000000000000000000000000');
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);
    await disableInterestAccrual(core, core.marketIds.weth);

    await factory.connect(core.governance).ownerSetAllowableCollateralMarketIds(
      [...allowableMarketIds, marketId],
    );

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<GmxV2IsolationModeTokenVaultV1>(
      vaultAddress,
      GmxV2IsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    await setupWETHBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);
    await wrapper.connect(core.governance).ownerSetIsHandler(core.gmxEcosystemV2!.gmxDepositHandler.address, true);
    await unwrapper.connect(core.governance).ownerSetIsHandler(core.gmxEcosystemV2!.gmxWithdrawalHandler.address, true);

    await wrapper.connect(core.governance).ownerSetCallbackGasLimit(callbackGasLimit);
    await unwrapper.connect(core.governance).ownerSetCallbackGasLimit(callbackGasLimit);

    liquidAccount = { owner: vault.address, number: borrowAccountNumber };

    // TODO; set up GM tokens.
    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#prepareForLiquidation', () => {
    it('should work normally for underwater account', async () => {
      await liquidator.prepareForLiquidation(
        liquidAccount,
        marketId,
        amountWei,
        core.marketIds.usdc,
        ONE_BI,
        NO_EXPIRY,
      );
      // TODO: check vault is frozen
      // TODO: check liquidation enqueued event
    });

    it('should work normally for expired account', async () => {
      const owedMarket = core.marketIds.usdc;
      await setExpiry(core, liquidAccount, owedMarket, 123);
      const expiry = await core.expiry.getExpiry(liquidAccount, owedMarket);
      await increaseByTimeDelta(1234);
      await liquidator.prepareForLiquidation(
        liquidAccount,
        marketId,
        amountWei,
        owedMarket,
        ONE_BI,
        expiry,
      );
      // TODO: check vault is frozen
      // TODO: check liquidation enqueued event
    });

    it('should fail when liquid account is not a valid vault', async () => {
    });

    it('should fail when expiration overflows', async () => {
    });

    it('should fail when position is not expired', async () => {
    });

    it('should fail when position expiration does not match input', async () => {
    });

    it('should fail when liquid account has no supply (should be vaporized)', async () => {
    });

    it('should fail when liquid account is not underwater', async () => {
    });
  });
});
