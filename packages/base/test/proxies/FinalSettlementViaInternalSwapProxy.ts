import { BigNumber, BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { FinalSettlementViaInternalSwapProxy } from 'packages/base/src/types';
import { createContractWithName } from 'packages/base/src/utils/dolomite-utils';
import { Network, ONE_ETH_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectProtocolBalance, expectThrow, expectWalletBalance } from '../utils/assertions';
import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { disableInterestAccrual, setupCoreProtocol } from '../utils/setup';

const supplier1 = {
  owner: '0xfb0214d7ac08ed0d2d9ca920ea6d4f4be2654ea5',
  number: '0',
}; // 60048+ GRAI
const supplier2 = {
  owner: '0xec0f08bc015a0d0fba1df0b8b11d4779f5a04326',
  number: '83739606014428120693479726400323499703449033428325717469693567927919900459359',
}; // 7298+ GRAI
const supplier3 = {
  owner: '0xca6ff368b9d4d78674e043b02ef94e887c8274d4',
  number: '83739606014428120693479726400323499703449033428325717469693567927919900459359',
}; // 6884+ GRAI

const borrower1 = {
  owner: '0x8369e7900ff2359bb36ef1c40a60e5f76373a6ed',
  number: '37854219164298205543318837200569737159185780940929918341294132776836393201738',
}; // 86077+ GRAI
const borrower2 = {
  owner: '0x823de6b63f9cb010cbb58951c90eea30bf02bd36',
  number: '69121517506769131984410677789384756549414360779327488007091207370556360388378',
}; // 8281+ GRAI
const borrower3 = {
  owner: '0x97974438301ba8aadd86b37a8b9e154ab2dc82c1',
  number: '35613495870568124694328532727313109428434151660544838181582888743390716149016',
}; // 5639+ GRAI
const reward = {
  value: parseEther(`${0.005}`),
};

describe('FinalSettlementViaInternalSwapProxy', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let finalSettlement: FinalSettlementViaInternalSwapProxy;

  let graiMarketId: BigNumberish;
  let usdcMarketId: BigNumberish;

  let graiPrice: BigNumber;
  let graiPriceAdj: BigNumber;
  let usdcPrice: BigNumber;

  let graiHeld1: BigNumber;
  let graiHeld2: BigNumber;
  let graiHeld3: BigNumber;
  let usdcHeld1: BigNumber;
  let usdcHeld2: BigNumber;
  let usdcHeld3: BigNumber;

  let graiBorrowed1: BigNumber;
  let graiBorrowed2: BigNumber;
  let graiBorrowed3: BigNumber;
  let usdcBorrowed1: BigNumber;
  let usdcBorrowed2: BigNumber;
  let usdcBorrowed3: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 333_072_300,
    });

    graiMarketId = core.marketIds.grai;
    usdcMarketId = core.marketIds.nativeUsdc;

    await disableInterestAccrual(core, graiMarketId);
    await disableInterestAccrual(core, usdcMarketId);

    graiPrice = (await core.dolomiteMargin.getMarketPrice(graiMarketId)).value;
    graiPriceAdj = graiPrice.mul(reward.value.add(ONE_ETH_BI)).div(ONE_ETH_BI);
    usdcPrice = (await core.dolomiteMargin.getMarketPrice(usdcMarketId)).value;
    console.log('\tPrices', graiPrice.toString(), graiPriceAdj.toString(), usdcPrice.toString());

    graiHeld1 = (await core.dolomiteMargin.getAccountWei(supplier1, graiMarketId)).value;
    graiHeld2 = (await core.dolomiteMargin.getAccountWei(supplier2, graiMarketId)).value;
    graiHeld3 = (await core.dolomiteMargin.getAccountWei(supplier3, graiMarketId)).value;
    usdcHeld1 = (await core.dolomiteMargin.getAccountWei(supplier1, usdcMarketId)).value;
    usdcHeld2 = (await core.dolomiteMargin.getAccountWei(supplier2, usdcMarketId)).value;
    usdcHeld3 = (await core.dolomiteMargin.getAccountWei(supplier3, usdcMarketId)).value;

    graiBorrowed1 = (await core.dolomiteMargin.getAccountWei(borrower1, graiMarketId)).value;
    graiBorrowed2 = (await core.dolomiteMargin.getAccountWei(borrower2, graiMarketId)).value;
    graiBorrowed3 = (await core.dolomiteMargin.getAccountWei(borrower3, graiMarketId)).value;
    usdcBorrowed1 = (await core.dolomiteMargin.getAccountWei(borrower1, usdcMarketId)).value;
    usdcBorrowed2 = (await core.dolomiteMargin.getAccountWei(borrower2, usdcMarketId)).value;
    usdcBorrowed3 = (await core.dolomiteMargin.getAccountWei(borrower3, usdcMarketId)).value;

    finalSettlement = await createContractWithName(
      'FinalSettlementViaInternalSwapProxy',
      [core.dolomiteMargin.address],
      {},
      core.governance,
    );
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(finalSettlement.address, true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#ownerForceWithdraw', () => {
    it('should work when the supplier can partially cover the debt', async () => {
      await finalSettlement.ownerForceWithdraw([supplier2, supplier3], graiMarketId);

      await expectWalletBalance(supplier2.owner, core.tokens.grai, graiHeld2);
      await expectWalletBalance(supplier3.owner, core.tokens.grai, graiHeld3);

      await expectProtocolBalance(core, supplier2.owner, supplier2.number, graiMarketId, ZERO_BI);
      await expectProtocolBalance(core, supplier3.owner, supplier3.number, graiMarketId, ZERO_BI);
    });

    it('should fail if the accounts are invalid', async () => {
      await expectThrow(
        finalSettlement.ownerForceWithdraw([], graiMarketId),
        'FinalSettlementViaInternalSwap: Invalid accounts',
      );
    });

    it('should fail if the caller is not the owner', async () => {
      await expectThrow(
        finalSettlement.connect(core.hhUser1).ownerForceWithdraw([], graiMarketId),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.addressLower}>`,
      );
    });
  });

  describe('#ownerSettle', () => {
    it('should work when the supplier can fully cover the debt', async () => {
      await finalSettlement.ownerSettle([borrower2], [supplier1], graiMarketId, usdcMarketId, reward);

      await expectProtocolBalance(core, borrower2.owner, borrower2.number, graiMarketId, ZERO_BI);
      await expectProtocolBalance(core, supplier1.owner, supplier1.number, graiMarketId, graiHeld1.sub(graiBorrowed2));

      const usdcReward = graiBorrowed2.mul(graiPriceAdj).div(usdcPrice);
      console.log('\tusdc amounts', usdcBorrowed2.toString(), usdcHeld1.toString(), usdcReward.toString());
      await expectProtocolBalance(core, supplier1.owner, supplier1.number, usdcMarketId, usdcHeld1.add(usdcReward));
      await expectProtocolBalance(core, borrower2.owner, borrower2.number, usdcMarketId, usdcBorrowed2.sub(usdcReward));
    });

    it('should work when the supplier can partially cover the debt', async () => {
      await finalSettlement.ownerSettle([borrower1], [supplier1], graiMarketId, usdcMarketId, reward);

      await expectProtocolBalance(core, supplier1.owner, supplier1.number, graiMarketId, ZERO_BI);
      await expectProtocolBalance(
        core,
        borrower1.owner,
        borrower1.number,
        graiMarketId,
        ZERO_BI.sub(graiBorrowed1.sub(graiHeld1)),
      );
    });

    it('should fail if the caller is not the owner', async () => {
      await expectThrow(
        finalSettlement.connect(core.hhUser1).ownerSettle([], [], graiMarketId, usdcMarketId, reward),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.addressLower}>`,
      );
    });

    it('should fail when accounts length do not match', async () => {
      await expectThrow(
        finalSettlement.ownerSettle([], [], graiMarketId, usdcMarketId, reward),
        'FinalSettlementViaInternalSwap: Invalid accounts',
      );
      await expectThrow(
        finalSettlement.ownerSettle([borrower1, borrower2], [supplier1], graiMarketId, usdcMarketId, reward),
        'FinalSettlementViaInternalSwap: Invalid accounts',
      );
    });

    it('should fail when markets are invalid', async () => {
      await expectThrow(
        finalSettlement.ownerSettle([borrower1], [supplier1], graiMarketId, graiMarketId, reward),
        'FinalSettlementViaInternalSwap: Invalid markets',
      );
    });

    it('should fail when the reward is invalid', async () => {
      await expectThrow(
        finalSettlement.ownerSettle([borrower1], [supplier1], graiMarketId, usdcMarketId, { value: 0 }),
        'FinalSettlementViaInternalSwap: Invalid reward',
      );
      await expectThrow(
        finalSettlement.ownerSettle([borrower1], [supplier1], graiMarketId, usdcMarketId, {
          value: parseEther(`${0.051}`),
        }),
        'FinalSettlementViaInternalSwap: Invalid reward',
      );
    });

    it('should fail when a borrow account does not have debt', async () => {
      await expectThrow(
        finalSettlement.ownerSettle([supplier1], [borrower1], graiMarketId, usdcMarketId, reward),
        `FinalSettlementViaInternalSwap: Invalid owed amount <${supplier1.owner.toLowerCase()}, ${supplier1.number}>`,
      );
    });

    it('should fail when a supply account does not have assets', async () => {
      await expectThrow(
        finalSettlement.ownerSettle([borrower1], [borrower1], graiMarketId, usdcMarketId, reward),
        `FinalSettlementViaInternalSwap: Invalid held amount <${borrower1.owner.toLowerCase()}, ${borrower1.number}>`,
      );
    });
  });
});
