import { Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import { expectProtocolBalance, expectProtocolBalanceIsGreaterThan } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  disableInterestAccrual,
  setupCoreProtocol,
  setupTestMarket,
  setupWBERABalance,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { BigNumber, ethers } from 'ethers';
import { formatEther, parseEther } from 'ethers/lib/utils';
import {
  IERC20,
  IPendlePtMarket,
  IPendlePtToken,
  PendlePtPriceOracle,
  PendleRegistry,
} from '../src/types';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { createPendleRegistry } from './pendle-ecosystem-utils';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { PendlePtPriceOracleV2__factory } from '../src/types/factories/contracts/PendlePtPriceOracleV2__factory';
import { getCalldataForOogaBooga } from 'packages/base/test/utils/trader-utils';
import { ActionType, AmountDenomination, AmountReference } from '@dolomite-exchange/dolomite-margin';

const defaultAccountNumber = '0';
const amountWei = parseEther('100');

const OOGA_BOOGA_TRADER = '0x0CE205f7bCBa70E4c03f826918c8c21073386ED3';

describe('PendlePtIBgtDec2025', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;

  let ptToken: IPendlePtToken;
  let ptMarket: IPendlePtMarket;
  let marketId: BigNumber;
  let underlyingToken: IERC20;

  let pendleRegistry: PendleRegistry;
  let priceOracle: PendlePtPriceOracle;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 12_127_000,
      network: Network.Berachain
    });
    await disableInterestAccrual(core, core.marketIds.wbera);

    ptMarket = core.pendleEcosystem!.iBgtDec2025.iBgtMarket;
    ptToken = core.pendleEcosystem!.iBgtDec2025.ptIBgtToken.connect(core.hhUser1);
    underlyingToken = core.tokens.iBgt!;

    pendleRegistry = await createPendleRegistry(
      core,
      ptMarket,
      core.pendleEcosystem!.iBgtDec2025.ptOracle,
      core.pendleEcosystem!.syIBgtToken,
    );
    priceOracle = await createContractWithAbi(
      PendlePtPriceOracleV2__factory.abi,
      PendlePtPriceOracleV2__factory.bytecode,
      [ptToken.address, pendleRegistry.address, core.dolomiteMargin.address],
    );

    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
      token: ptToken.address,
      decimals: 18,
      oracleInfos: [
        {
          oracle: priceOracle.address,
          tokenPair: underlyingToken.address,
          weight: 100,
        },
      ],
    });

    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, ptToken, true, core.oracleAggregatorV2);

    await setupWBERABalance(core, core.hhUser1, amountWei, core.depositWithdrawalRouter);
    await core.depositWithdrawalRouter.connect(core.hhUser1).depositWei(
      ZERO_BI,
      defaultAccountNumber,
      core.marketIds.wbera,
      amountWei,
      0
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('zap', () => {
    it('should work to zap with wbera', async () => {
      const { calldata, outputAmount } = await getCalldataForOogaBooga(
        Network.Berachain,
        core.tokens.wbera,
        amountWei,
        ptToken,
        { address: OOGA_BOOGA_TRADER }
      );

      const actualOrderData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [outputAmount, calldata],
      );

      await core.dolomiteMargin.connect(core.hhUser1).operate(
        [{ owner: core.hhUser1.address, number: defaultAccountNumber }],
        [
          {
            actionType: ActionType.Sell,
            primaryMarketId: core.marketIds.wbera,
            secondaryMarketId: marketId,
            accountId: 0,
            otherAccountId: 0,
            amount: { sign: false, denomination: AmountDenomination.Wei, ref: AmountReference.Delta, value: amountWei },
            otherAddress: OOGA_BOOGA_TRADER,
            data: actualOrderData
          },
        ],
        { gasLimit: 10000000 },
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.wbera, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        marketId,
        outputAmount,
        0
      );

      const { calldata: calldata2, outputAmount: outputAmount2 } = await getCalldataForOogaBooga(
        Network.Berachain,
        ptToken,
        outputAmount,
        core.tokens.wbera,
        { address: OOGA_BOOGA_TRADER }
      );

      const actualOrderData2 = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [outputAmount2, calldata2],
      );

      await core.dolomiteMargin.connect(core.hhUser1).operate(
        [{ owner: core.hhUser1.address, number: defaultAccountNumber }],
        [
          {
            actionType: ActionType.Sell,
            primaryMarketId: marketId,
            secondaryMarketId: core.marketIds.wbera,
            accountId: 0,
            otherAccountId: 0,
            amount: {
              sign: false,
              denomination: AmountDenomination.Wei,
              ref: AmountReference.Delta,
              value: outputAmount
            },
            otherAddress: OOGA_BOOGA_TRADER,
            data: actualOrderData2
          },
        ],
        { gasLimit: 10000000 },
      );
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        core.marketIds.wbera,
        outputAmount2,
        0
      );
    });
  });

  describe('price oracle', () => {
    it('should work to get the price of pt-iBgt', async () => {
      const price = await core.oracleAggregatorV2.getPrice(ptToken.address);
      console.log(formatEther(price.value));
    });
  });
});
