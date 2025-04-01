import { parseEther } from "ethers/lib/utils";
import { createDepositAction, depositIntoDolomiteMargin } from "../src/utils/dolomite-utils";
import { expectThrow } from "./utils/assertions";
import { expectProtocolBalance } from "./utils/assertions";
import { Network, ONE_ETH_BI, ZERO_BI } from "../src/utils/no-deps-constants";
import { getRealLatestBlockNumber, revertToSnapshotAndCapture, snapshot } from "./utils";
import { CoreProtocolArbitrumOne } from "./utils/core-protocols/core-protocol-arbitrum-one";
import { disableInterestAccrual, getDefaultCoreProtocolConfig, setupCoreProtocol, setupDAIBalance } from "./utils/setup";

describe('SampleLocalOperator', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    await disableInterestAccrual(core, core.marketIds.dai);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#sampleLocalOperator', () => {
    it('should work normally', async () => {
      // Setup user 1 and user 2 with 100 DAI each
      const daiAmount = parseEther('100');
      await setupDAIBalance(core, core.hhUser1, daiAmount, core.dolomiteMargin);
      await setupDAIBalance(core, core.hhUser2, daiAmount, core.dolomiteMargin);

      // User 1 deposits 100 DAI into the default account
      await depositIntoDolomiteMargin(core, core.hhUser1, ZERO_BI, core.marketIds.dai, daiAmount);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.dai, daiAmount);

      // User 2 tries to deposit for user 1 but it fails because not set as local operator
      await expectThrow(
        core.dolomiteMargin.connect(core.hhUser2).operate(
          [{ owner: core.hhUser1.address, number: ZERO_BI }],
          [createDepositAction(daiAmount, core.marketIds.dai, core.hhUser1, core.hhUser2.address)],
          { gasLimit: 10_000_000 },
        ),
        `Storage: Unpermissioned operator <${core.hhUser2.address.toLowerCase()}>`
      );

      // User 1 sets user 2 as a local operator
      await core.dolomiteMargin.connect(core.hhUser1).setOperators(
        [{ operator: core.hhUser2.address, trusted: true }]
      );

      // User 2 deposits 100 DAI into the default account of user 1
      await core.dolomiteMargin
        .connect(core.hhUser2)
        .operate(
          [{ owner: core.hhUser1.address, number: ZERO_BI }],
          [createDepositAction(daiAmount, core.marketIds.dai, core.hhUser1, core.hhUser2.address)],
          { gasLimit: 10_000_000 },
        );
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.dai, daiAmount.mul(2));
    });
  });
});
