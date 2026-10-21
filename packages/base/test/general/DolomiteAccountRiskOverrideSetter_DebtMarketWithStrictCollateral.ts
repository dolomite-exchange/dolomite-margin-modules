import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { defaultAbiCoder, parseEther } from 'ethers/lib/utils';
import { RegistryProxy, RegistryProxy__factory } from '../../src/types';
import { DolomiteAccountRiskOverrideSetter } from '../../src/types/contracts/general/DolomiteAccountRiskOverrideSetter';
import {
  DolomiteAccountRiskOverrideSetter__factory,
} from '../../src/types/factories/contracts/general/DolomiteAccountRiskOverrideSetter__factory';
import { getRegistryProxyConstructorParams } from '../../src/utils/constructors/dolomite';
import { createContractWithAbi, depositIntoDolomiteMargin } from '../../src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ONE_BI, ZERO_BI } from '../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectEvent, expectThrow } from '../utils/assertions';
import { CoreProtocolBerachain } from '../utils/core-protocols/core-protocol-berachain';
import { setupCoreProtocol, setupWBERABalance, setupWETHBalance } from '../utils/setup';

const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = BigNumber.from(123);

const wberaAmount = parseEther('100');
const wethAmount = parseEther('1');

enum RiskFeature {
  NONE,
  BORROW_ONLY,
  SINGLE_COLLATERAL_WITH_STRICT_DEBT,
  DEBT_MARKET_WITH_STRICT_COLLATERAL,
}

function getBitmap(marketIds: BigNumberish[]): BigNumber {
  return marketIds.reduce<BigNumber>(
    (bitmap, marketId) => bitmap.or(ONE_BI.shl(BigNumber.from(marketId).toNumber())),
    ZERO_BI,
  );
}

describe('DolomiteAccountRiskOverrideSetter_DEBT_MARKET_WITH_STRICT_COLLATERAL', () => {
  let snapshotId: string;
  let core: CoreProtocolBerachain;
  let riskOverrideSetter: DolomiteAccountRiskOverrideSetter;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.Berachain,
      blockNumber: 27_780_000,
    });

    const riskOverrideSetterImplementation = await createContractWithAbi<DolomiteAccountRiskOverrideSetter>(
      DolomiteAccountRiskOverrideSetter__factory.abi,
      DolomiteAccountRiskOverrideSetter__factory.bytecode,
      [core.dolomiteMargin.address],
    );
    const calldata = (await riskOverrideSetterImplementation.populateTransaction.initialize()).data!;
    const proxy = await createContractWithAbi<RegistryProxy>(
      RegistryProxy__factory.abi,
      RegistryProxy__factory.bytecode,
      getRegistryProxyConstructorParams(riskOverrideSetterImplementation.address, calldata, core.dolomiteMargin),
    );
    riskOverrideSetter = DolomiteAccountRiskOverrideSetter__factory.connect(proxy.address, core.hhUser1);

    await core.dolomiteMargin.connect(core.governance).ownerSetDefaultAccountRiskOverride(riskOverrideSetter.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  async function setStrictCollateral(debtMarketId: BigNumberish, collateralMarketIds: BigNumberish[]) {
    return riskOverrideSetter.connect(core.governance).ownerSetRiskFeatureByMarketId(
      debtMarketId,
      RiskFeature.DEBT_MARKET_WITH_STRICT_COLLATERAL,
      defaultAbiCoder.encode(['uint256'], [getBitmap(collateralMarketIds)]),
    );
  }

  describe('#ownerSetRiskFeatureByMarketId', () => {
    it('should work normally', async () => {
      const collateralBitmap = getBitmap([core.marketIds.wbera, core.marketIds.weth]);
      const extraData = defaultAbiCoder.encode(['uint256'], [collateralBitmap]);
      const res = await riskOverrideSetter.connect(core.governance).ownerSetRiskFeatureByMarketId(
        core.marketIds.usdc,
        RiskFeature.DEBT_MARKET_WITH_STRICT_COLLATERAL,
        extraData,
      );
      await expectEvent(riskOverrideSetter, res, 'RiskFeatureSet', {
        extraData,
        marketId: core.marketIds.usdc,
        riskFeature: RiskFeature.DEBT_MARKET_WITH_STRICT_COLLATERAL,
      });

      expect(await riskOverrideSetter.getRiskFeatureByMarketId(core.marketIds.usdc))
        .to.eq(RiskFeature.DEBT_MARKET_WITH_STRICT_COLLATERAL);
      const result = await riskOverrideSetter.getRiskFeatureParamByMarketId(core.marketIds.usdc);
      expect(result.riskFeature).to.eq(RiskFeature.DEBT_MARKET_WITH_STRICT_COLLATERAL);
      expect(result.extraData).to.eq(extraData);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        riskOverrideSetter.connect(core.hhUser1).ownerSetRiskFeatureByMarketId(
          core.marketIds.usdc,
          RiskFeature.DEBT_MARKET_WITH_STRICT_COLLATERAL,
          defaultAbiCoder.encode(['uint256'], [getBitmap([core.marketIds.wbera])]),
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if the collateral bitmap is empty', async () => {
      await expectThrow(
        setStrictCollateral(core.marketIds.usdc, []),
        'AccountRiskOverrideSetter: Invalid collateral bitmap',
      );
    });

    it('should fail if extra data does not encode a collateral bitmap', async () => {
      for (const extraData of [BYTES_EMPTY, '0x1234']) {
        await expectThrow(
          riskOverrideSetter.connect(core.governance).ownerSetRiskFeatureByMarketId(
            core.marketIds.usdc, RiskFeature.DEBT_MARKET_WITH_STRICT_COLLATERAL, extraData,
          ),
        );
      }
    });
  });

  describe('#getRiskFeatureForDebtMarketWithStrictCollateral', () => {
    it('should return the allowed collateral bitmap', async () => {
      await setStrictCollateral(core.marketIds.usdc, [core.marketIds.wbera, core.marketIds.weth]);
      expect(await riskOverrideSetter.getRiskFeatureForDebtMarketWithStrictCollateral(core.marketIds.usdc))
        .to.eq(getBitmap([core.marketIds.wbera, core.marketIds.weth]));
    });

    it('should fail if the market has no risk feature', async () => {
      await expectThrow(
        riskOverrideSetter.getRiskFeatureForDebtMarketWithStrictCollateral(core.marketIds.usdc),
        'AccountRiskOverrideSetter: Invalid risk feature <0>',
      );
    });

    it('should fail if the market has a different risk feature', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetRiskFeatureByMarketId(
        core.marketIds.usdc, RiskFeature.BORROW_ONLY, BYTES_EMPTY,
      );
      await expectThrow(
        riskOverrideSetter.getRiskFeatureForDebtMarketWithStrictCollateral(core.marketIds.usdc),
        'AccountRiskOverrideSetter: Invalid risk feature <1>',
      );
    });
  });

  describe('#getAccountRiskOverride', () => {
    it('should return 0 if the account has no balances', async () => {
      await setStrictCollateral(core.marketIds.usdc, [core.marketIds.wbera]);

      const result = await riskOverrideSetter.getAccountRiskOverride(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
      );
      expect(result[0].value).to.eq(ZERO_BI);
      expect(result[1].value).to.eq(ZERO_BI);
    });

    it('should return 0 if the account has no debt', async () => {
      await setStrictCollateral(core.marketIds.wbera, [core.marketIds.weth]);
      await setupWBERABalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.wbera, wberaAmount);

      const result = await riskOverrideSetter.getAccountRiskOverride(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
      );
      expect(result[0].value).to.eq(ZERO_BI);
      expect(result[1].value).to.eq(ZERO_BI);
    });

    it('should work normally with allowed collateral', async () => {
      await setStrictCollateral(core.marketIds.usdc, [core.marketIds.wbera]);
      await setupWBERABalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.wbera, wberaAmount);
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        BigNumber.from('100000'),
        BalanceCheckFlag.None,
      );

      const result = await riskOverrideSetter.getAccountRiskOverride(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
      );
      expect(result[0].value).to.eq(ZERO_BI);
      expect(result[1].value).to.eq(ZERO_BI);
    });

    it('should work normally with a subset of the allowed collateral', async () => {
      await setStrictCollateral(core.marketIds.usdc, [core.marketIds.wbera, core.marketIds.weth]);
      await setupWBERABalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.wbera, wberaAmount);
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        BigNumber.from('100000'),
        BalanceCheckFlag.None,
      );

      const result = await riskOverrideSetter.getAccountRiskOverride(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
      );
      expect(result[0].value).to.eq(ZERO_BI);
      expect(result[1].value).to.eq(ZERO_BI);
    });

    it('should work normally with multiple allowed collateral markets', async () => {
      await setStrictCollateral(core.marketIds.usdc, [core.marketIds.wbera, core.marketIds.weth]);
      await setupWBERABalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.wbera, wberaAmount);
      await setupWETHBalance(core, core.hhUser1, wethAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, wethAmount);
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        BigNumber.from('100000'),
        BalanceCheckFlag.None,
      );

      const result = await riskOverrideSetter.getAccountRiskOverride(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
      );
      expect(result[0].value).to.eq(ZERO_BI);
      expect(result[1].value).to.eq(ZERO_BI);
    });

    it('should fail if collateral is outside the allowed bitmap', async () => {
      await setStrictCollateral(core.marketIds.usdc, [core.marketIds.weth]);
      await setupWBERABalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.wbera, wberaAmount);

      await expectThrow(
        core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.usdc,
          BigNumber.from('100000'),
          BalanceCheckFlag.None,
        ),
        `AccountRiskOverrideSetter: Invalid collateral for market <${core.marketIds.usdc.toString()}>`,
      );
    });

    it('should fail if only some collateral markets are allowed', async () => {
      await setStrictCollateral(core.marketIds.usdc, [core.marketIds.wbera]);
      await setupWBERABalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await setupWETHBalance(core, core.hhUser1, wethAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.wbera, wberaAmount);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, wethAmount);

      await expectThrow(
        core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.usdc,
          BigNumber.from('100000'),
          BalanceCheckFlag.None,
        ),
        `AccountRiskOverrideSetter: Invalid collateral for market <${core.marketIds.usdc.toString()}>`,
      );
    });

    it('should ignore other debt markets when validating collateral', async () => {
      await setStrictCollateral(core.marketIds.usdc, [core.marketIds.wbera]);
      await setupWBERABalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.wbera, wberaAmount);
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        BigNumber.from('100000'),
        BalanceCheckFlag.None,
      );
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdt,
        BigNumber.from('100000'),
        BalanceCheckFlag.None,
      );

      const result = await riskOverrideSetter.getAccountRiskOverride(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
      );
      expect(result[0].value).to.eq(ZERO_BI);
      expect(result[1].value).to.eq(ZERO_BI);
    });
  });
});
