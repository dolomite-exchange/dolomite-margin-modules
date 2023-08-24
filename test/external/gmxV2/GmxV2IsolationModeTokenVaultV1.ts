import { BalanceCheckFlag } from "@dolomite-exchange/dolomite-margin";
import { BigNumber } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { GmxRegistryV2, GmxV2IsolationModeTokenVaultV1, GmxV2IsolationModeTokenVaultV1__factory, GmxV2IsolationModeUnwrapperTraderV2, GmxV2IsolationModeVaultFactory, GmxV2IsolationModeWrapperTraderV2, GmxV2MarketTokenPriceOracle, IGmxMarketToken } from "src/types";
import { depositIntoDolomiteMargin } from "src/utils/dolomite-utils";
import { Network, ZERO_BI } from "src/utils/no-deps-constants";
import { getRealLatestBlockNumber, revertToSnapshotAndCapture, snapshot } from "test/utils";
import { expectProtocolBalance, expectThrow, expectWalletBalance } from "test/utils/assertions";
import { createGmxRegistryV2, createGmxV2IsolationModeTokenVaultV1, createGmxV2IsolationModeUnwrapperTraderV2, createGmxV2IsolationModeVaultFactory, createGmxV2IsolationModeWrapperTraderV2 } from "test/utils/ecosystem-token-utils/gmx";
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol, setupGMBalance, setupTestMarket, setupUSDCBalance, setupUserVaultProxy } from "test/utils/setup";

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';

describe('GmxV2IsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IGmxMarketToken;
  let gmxRegistryV2: GmxRegistryV2;
  let unwrapper: GmxV2IsolationModeUnwrapperTraderV2;
  let wrapper: GmxV2IsolationModeWrapperTraderV2;
  let priceOracle: GmxV2MarketTokenPriceOracle;
  let factory: GmxV2IsolationModeVaultFactory;
  let vault: GmxV2IsolationModeTokenVaultV1;
  let marketId: BigNumber;

  before(async () => {
    const latestBlockNumber = await getRealLatestBlockNumber(true, Network.ArbitrumOne);
    core = await setupCoreProtocol({
      blockNumber: latestBlockNumber,
      network: Network.ArbitrumOne,
    });
    underlyingToken = core.gmxEcosystem!.gmxEthUsdMarketToken.connect(core.hhUser1);
    const userVaultImplementation = await createGmxV2IsolationModeTokenVaultV1();
    gmxRegistryV2 = await createGmxRegistryV2(core);
    factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxRegistryV2,
        [], // initialAllowableDebtMarketIds
        [], // initialAllowableCollateralMarketIds
        core.gmxEcosystem!.gmxEthUsdMarketToken,
        userVaultImplementation
    );
    unwrapper = await createGmxV2IsolationModeUnwrapperTraderV2(core, factory, gmxRegistryV2);
    wrapper = await createGmxV2IsolationModeWrapperTraderV2(core, factory, gmxRegistryV2);

    // Use actual price oracle later
    await core.testEcosystem!.testPriceOracle!.setPrice(
      factory.address,
      '1000000000000000000000000000000',
    );
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<GmxV2IsolationModeTokenVaultV1>(
      vaultAddress,
      GmxV2IsolationModeTokenVaultV1__factory,
      core.hhUser1
    );

    await setupUSDCBalance(core, core.hhUser1, 1000e6, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, 1000e6);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {});
  });

  describe('#initiateWrapping', () => {
    it('should work normally', async () => {
      await vault.connect(core.hhUser1).transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.usdc,
        1000e6,
        BalanceCheckFlag.Both
      );
      await vault.connect(core.hhUser1).initiateWrapping(
        borrowAccountNumber,
        [core.marketIds.usdc, marketId],
        1000e6,
        10,
        [{ trader: wrapper.address, traderType: 3, tradeData: '0x', makerAccountIndex: 0}],
        [],
        { deadline: '123123123123123', balanceCheckFlag: 3 }
      );

      // console.log(await core.dolomiteMargin.getAccountWei({ owner: vault.address, number: borrowAccountNumber }, marketId));
    });

    it('should fail when vault is frozen', async () => {
      // await vault.connect(core.hhUser1).initiateWrapping();
      // await expectThrow(
      //   vault.connect(core.hhUser1).initiateWrapping(),
      //   'GmxV2IsolationModeVaultV1: Vault is frozen',
      // );
    });
  });

  describe('#afterDepositExecution', () => {
    it('should work normally', async () => {});
    it('should fail when not called by deposit handler', async () => {});
  });

  describe('#afterDepositCancellation', () => {
    it('should work normally', async () => {});
    it('should fail when not called by deposit handler', async () => {

    });
  });

  describe('#initiateUnwrapping', () => {
    it('should work normally', async () => {});
    it('should fail when vault is frozen', async () => {
      await vault.connect(core.hhUser1).initiateUnwrapping();
      await expectThrow(
        vault.connect(core.hhUser1).initiateUnwrapping(),
        'GmxV2IsolationModeVaultV1: Vault is frozen',
      );
    });
  });

  describe('#afterWithdrawalExecution', () => {
    it('should work normally', async () => {});
    it('should fail when not called by withdrawal handler', async () => {});
  });

  describe('#afterWithdrawalCancellation', () => {
    it('should work normally', async () => {});
    it('should fail when not called by withdrawal handler', async () => {});
  });

  describe.only('#executeDepositIntoVault', () => {
    it('should work normally if deposit from vault owner', async () => {
      await setupGMBalance(core, core.hhUser1, parseEther("1"), vault);
      await vault.connect(core.hhUser1).depositIntoVaultForDolomiteMargin(defaultAccountNumber, parseEther("1"));
      expectWalletBalance(core.hhUser1, underlyingToken, ZERO_BI);
      expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, parseEther("1"));
    });
  });
});