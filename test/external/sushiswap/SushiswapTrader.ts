import { ZERO_ADDRESS } from "@openzeppelin/upgrades/lib/utils/Addresses";
import { expect } from "chai";
import { BigNumber, ethers } from "ethers";
import {
  IERC4626,
  IUniswapV2Router02,
  SushiswapTrader,
  SushiswapTrader__factory,
} from "../../../src/types";
import { Account } from "../../../src/types/IDolomiteMargin";
import { createContractWithAbi, depositIntoDolomiteMargin } from "../../../src/utils/dolomite-utils";
import { BYTES_EMPTY, Network, ZERO_BI } from "../../../src/utils/no-deps-constants";
import { impersonate, revertToSnapshotAndCapture, snapshot } from "../../utils";
import { expectThrow } from "../../utils/assertions";
import { CoreProtocol, setupCoreProtocol, setupTestMarket, setupUSDCBalance } from "../../utils/setup";

const defaultAccountNumber = "0";
const amountWei = BigNumber.from("200000000000000000000"); // $200
const otherAmountWei = BigNumber.from("10000000"); // $10
const usdcAmount = amountWei.div(1e12).mul(5);
const usableUsdcAmount = usdcAmount.div(2);

const abiCoder = ethers.utils.defaultAbiCoder;

describe("SushiswapTrader", () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let router: IUniswapV2Router02;
  let trader: SushiswapTrader;
  let defaultAccount: Account.InfoStruct;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 81874000,
      network: Network.ArbitrumOne,
    });
    router = core.sushiEcosystem!.router;

    // no need to create this market
    // await setupTestMarket(core, core.usdc, false);

    trader = await createContractWithAbi<SushiswapTrader>(
      SushiswapTrader__factory.abi,
      SushiswapTrader__factory.bytecode,
      [router.address, core.dolomiteMargin.address]
    );

    defaultAccount = { owner: core.hhUser1.address, number: defaultAccountNumber };

    // setting the interest rate to 0 makes calculations more consistent
    await core.dolomiteMargin.ownerSetInterestSetter(core.marketIds.usdc, core.alwaysZeroInterestSetter.address);

    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccount.number, core.marketIds.usdc, usableUsdcAmount);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe("Exchange for non-liquidation sale", () => {
    it("should work when called with the normal conditions", async () => {
      const solidAccountId = 0;
      const liquidAccountId = 0;
      const actions = await trader.createActionsForWrapping(
        solidAccountId,
        liquidAccountId,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        core.marketIds.weth,
        core.marketIds.usdc,
        ZERO_BI,
        usableUsdcAmount
      );

      const amountOut = await trader.getExchangeCost(
        core.usdc.address,
        core.weth.address,
        usableUsdcAmount,
        abiCoder.encode(["address[]"], [[core.usdc.address, core.weth.address]])
      );

      const wethBalanceWeiBefore = await core.weth.balanceOf(core.dolomiteMargin.address);

      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await core.dolomiteMargin.connect(core.hhUser5).operate([defaultAccount], actions);

      const wethBalanceWeiAfter = await core.weth.balanceOf(core.dolomiteMargin.address);

      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.weth);
      expect(underlyingBalanceWei.value).to.eq(amountOut);
      expect(underlyingBalanceWei.sign).to.eq(true);
      expect(wethBalanceWeiAfter.sub(wethBalanceWeiBefore)).to.eq(amountOut);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.usdc);
      expect(otherBalanceWei.value).to.eq(ZERO_BI);
    });
  });

  describe("#exchange", () => {
    it("should fail if not called by DolomiteMargin", async () => {
      await expectThrow(
        trader
          .connect(core.hhUser1)
          .exchange(
            core.hhUser1.address,
            core.dolomiteMargin.address,
            core.weth.address,
            core.usdc.address,
            usableUsdcAmount,
            BYTES_EMPTY
          ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`
      );
    });

    it("should fail if input token is not compatible with path", async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        trader
          .connect(dolomiteMarginImpersonator)
          .exchange(
            core.hhUser1.address,
            core.dolomiteMargin.address,
            core.usdc.address,
            core.weth.address,
            usableUsdcAmount,
            abiCoder.encode(["uint256", "bytes"], [ZERO_BI, abiCoder.encode(["address[]"], [[core.usdc.address, core.weth.address]])])
          ),
        `SushiswapTrader: Invalid input token <${core.weth.address.toLowerCase()}>`
      );
    });

    it("should fail if output token is incorrect", async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        trader
          .connect(dolomiteMarginImpersonator)
          .exchange(
            core.hhUser1.address,
            core.dolomiteMargin.address,
            core.weth.address,
            core.usdc.address,
            amountWei,
            abiCoder.encode(["uint256", "bytes"], [otherAmountWei, abiCoder.encode(["address[]"], [[core.usdc.address, core.usdc.address]])])
          ),
        `SushiswapTrader: Invalid output token <${core.weth.address.toLowerCase()}>`
      );
    });

    it("should fail if input amount is 0", async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        trader
          .connect(dolomiteMarginImpersonator)
          .exchange(
            core.hhUser1.address,
            core.dolomiteMargin.address,
            core.weth.address,
            core.usdc.address,
            ZERO_BI,
            abiCoder.encode(["uint256", "bytes"], [otherAmountWei, abiCoder.encode(["address[]"], [[core.usdc.address, core.weth.address]])])
          ),
        "SushiswapTrader: Invalid input amount"
      );
    });
  });

  describe("#SUSHI_ROUTER", () => {
    it("should work", async () => {
      expect(await trader.SUSHI_ROUTER()).to.eq(router.address);
    });
  });

  describe("#actionsLength", () => {
    it("should work", async () => {
      expect(await trader.actionsLength()).to.eq(1);
    });
  });

  describe("#getExchangeCost", () => {
    it("should work normally", async () => {
      const inputAmount = usableUsdcAmount;
      const amounts = await router.getAmountsOut(inputAmount, [core.usdc.address, core.weth.address]);
      const expectedAmount = amounts[amounts.length - 1];
      const orderData = abiCoder.encode(["address[]"], [[core.usdc.address, core.weth.address]]);
      expect(await trader.getExchangeCost(core.usdc.address, core.weth.address, inputAmount, orderData)).to.eq(
        expectedAmount
      );
    });

    it("should work for 10 random numbers, as long as balance is sufficient", async () => {
      for (let i = 0; i < 10; i++) {
        // create a random number from 1 to 99 and divide by 101 (making the number, at-most, slightly smaller)
        const randomNumber = BigNumber.from(Math.floor(Math.random() * 99) + 1);
        const weirdAmount = usableUsdcAmount.mul(randomNumber).div(101);
        const amounts = await router.getAmountsOut(weirdAmount, [core.usdc.address, core.weth.address]);
        const expectedAmount = amounts[amounts.length - 1];
        const orderData = abiCoder.encode(["address[]"], [[core.usdc.address, core.weth.address]]);
        expect(await trader.getExchangeCost(core.usdc.address, core.weth.address, weirdAmount, orderData)).to.eq(
          expectedAmount
        );
      }
    });

    it("should fail if the input token is not matched", async () => {
      await expectThrow(
        trader.getExchangeCost(
          core.weth.address,
          core.weth.address,
          usableUsdcAmount,
          abiCoder.encode(["address[]"], [[core.usdc.address, core.usdc.address]])
        ),
        `SushiswapTrader: Invalid input token <${core.weth.address.toLowerCase()}>`
      );
    });

    it("should fail if the output token is not matched", async () => {
      await expectThrow(
        trader.getExchangeCost(
          core.usdc.address,
          core.usdc.address,
          usableUsdcAmount,
          abiCoder.encode(["address[]"], [[core.usdc.address, core.weth.address]])
        ),
        `SushiswapTrader: Invalid output token <${core.usdc.address.toLowerCase()}>`
      );
    });

    it("should fail if the input amount is 0", async () => {
      await expectThrow(
        trader.getExchangeCost(
          core.usdc.address,
          core.weth.address,
          ZERO_BI,
          abiCoder.encode(["address[]"], [[core.usdc.address, core.weth.address]])
        ),
        "SushiswapTrader: Invalid desired input amount"
      );
    });
  });
});
