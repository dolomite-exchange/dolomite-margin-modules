import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '../utils/setup';
import { BYTES_ZERO, Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { createAndUpgradeDolomiteRegistry } from '../utils/dolomite';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { expectEvent, expectThrow } from '../utils/assertions';
import { TestSmartDebtSettings, TestSmartDebtSettings__factory } from 'packages/base/src/types';
import { PairType } from '../utils/trader-utils';
import { BigNumber } from 'ethers';

const USDC_USDT_PAIR_BYTES = '0x89832631fb3c3307a103ba2c84ab569c64d6182a18893dcd163f0f1c2090733a';
const defaultAccountNumber = 0;

describe('SmartDebtSettings', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let trader: TestSmartDebtSettings;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    await createAndUpgradeDolomiteRegistry(core);

    trader = await createContractWithAbi<TestSmartDebtSettings>(
      TestSmartDebtSettings__factory.abi,
      TestSmartDebtSettings__factory.bytecode,
      [core.config.network, core.dolomiteRegistry.address, core.dolomiteMargin.address]
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#userSetPair', () => {
    it('should work normally for smart debt', async () => {
      await expectEmptyPair(trader, core.hhUser1.address, defaultAccountNumber);

      await trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt);
      const res = await trader.connect(core.hhUser1).userSetPair(
        defaultAccountNumber,
        PairType.SMART_DEBT,
        core.marketIds.usdc,
        core.marketIds.usdt,
        ZERO_BI,
        ZERO_BI
      );
      await expectEvent(trader, res, 'UserToPairSet', {
        user: core.hhUser1.address,
        accountNumber: defaultAccountNumber,
        pairType: PairType.SMART_DEBT,
        pairBytes: USDC_USDT_PAIR_BYTES
      });
      await expectPair(trader, core.hhUser1.address, defaultAccountNumber, PairType.SMART_DEBT, USDC_USDT_PAIR_BYTES);
    });

    it('should work normally for smart collateral', async () => {
      await expectEmptyPair(trader, core.hhUser1.address, defaultAccountNumber);

      await trader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt);
      const res = await trader.connect(core.hhUser1).userSetPair(
        defaultAccountNumber,
        PairType.SMART_COLLATERAL,
        core.marketIds.usdc,
        core.marketIds.usdt,
        ZERO_BI,
        ZERO_BI
      );
      await expectEvent(trader, res, 'UserToPairSet', {
        user: core.hhUser1.address,
        accountNumber: defaultAccountNumber,
        pairType: PairType.SMART_COLLATERAL,
        pairBytes: USDC_USDT_PAIR_BYTES
      });
      await expectPair(
        trader,
        core.hhUser1.address,
        defaultAccountNumber,
        PairType.SMART_COLLATERAL,
        USDC_USDT_PAIR_BYTES
      );
    });

    it('should work normally to remove pair', async () => {
      await expectEmptyPair(trader, core.hhUser1.address, defaultAccountNumber);

      await trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt);
      const res = await trader.connect(core.hhUser1).userSetPair(
        defaultAccountNumber,
        PairType.SMART_DEBT,
        core.marketIds.usdc,
        core.marketIds.usdt,
        ZERO_BI,
        ZERO_BI
      );
      await expectEvent(trader, res, 'UserToPairSet', {
        user: core.hhUser1.address,
        accountNumber: defaultAccountNumber,
        pairType: PairType.SMART_DEBT,
        pairBytes: USDC_USDT_PAIR_BYTES
      });
      await expectPair(trader, core.hhUser1.address, defaultAccountNumber, PairType.SMART_DEBT, USDC_USDT_PAIR_BYTES);

      const res2 = await trader.connect(core.hhUser1).userSetPair(
        defaultAccountNumber,
        PairType.NONE,
        core.marketIds.usdc,
        core.marketIds.usdt,
        ZERO_BI,
        ZERO_BI
      );
      await expectEvent(trader, res2, 'UserToPairSet', {
        user: core.hhUser1.address,
        accountNumber: defaultAccountNumber,
        pairType: PairType.NONE,
        pairBytes: BYTES_ZERO
      });
      await expectEmptyPair(trader, core.hhUser1.address, defaultAccountNumber);
    });

    it('should fail if smart debt pair does not exist', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).userSetPair(
          defaultAccountNumber,
          PairType.SMART_DEBT,
          core.marketIds.usdc,
          core.marketIds.usdt,
          ZERO_BI,
          ZERO_BI
        ),
        'SmartDebtSettings: Pair does not exist'
      );
    });

    it('should fail if smart collateral pair does not exist', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).userSetPair(
          defaultAccountNumber,
          PairType.SMART_COLLATERAL,
          core.marketIds.usdc,
          core.marketIds.usdt,
          ZERO_BI,
          ZERO_BI
        ),
        'SmartDebtSettings: Pair does not exist'
      );
    });

    it('should fail if pair type is invalid', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).userSetPair(
          defaultAccountNumber,
          /* pairType */ 5,
          core.marketIds.usdc,
          core.marketIds.usdt,
          ZERO_BI,
          ZERO_BI
        )
      );
    });
  });

  describe('#ownerAddSmartDebtPair', () => {
    it('should work normally', async () => {
      const res = await trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt);
      await expectEvent(trader, res, 'SmartDebtPairAdded', {
        marketId1: core.marketIds.usdc,
        marketId2: core.marketIds.usdt
      });

      expect(await trader.isSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt)).to.be.true;
      expect(await trader.isSmartDebtPair(core.marketIds.usdt, core.marketIds.usdc)).to.be.true;
    });

    it('should fail if pair already exists', async () => {
      await trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt);
      await expectThrow(
        trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt),
        'SmartDebtSettings: Pair already exists'
      );
      await expectThrow(
        trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdt, core.marketIds.usdc),
        'SmartDebtSettings: Pair already exists'
      );
    });

    it('should fail if market IDs are the same', async () => {
      await expectThrow(
        trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdc),
        'SmartDebtSettings: Market IDs must be different'
      );
    });

    it('should fail if not owner', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerRemoveSmartDebtPair', () => {
    it('should work normally', async () => {
      await trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt);
      expect(await trader.isSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt)).to.be.true;

      const res = await trader.connect(core.governance).ownerRemoveSmartDebtPair(
        core.marketIds.usdc,
        core.marketIds.usdt
      );
      await expectEvent(trader, res, 'SmartDebtPairRemoved', {
        marketId1: core.marketIds.usdc,
        marketId2: core.marketIds.usdt
      });

      expect(await trader.isSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt)).to.be.false;
      expect(await trader.isSmartDebtPair(core.marketIds.usdt, core.marketIds.usdc)).to.be.false;
    });

    it('should fail if pair does not exist', async () => {
      await expectThrow(
        trader.connect(core.governance).ownerRemoveSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt),
        'SmartDebtSettings: Pair does not exist'
      );
      await expectThrow(
        trader.connect(core.governance).ownerRemoveSmartDebtPair(core.marketIds.usdt, core.marketIds.usdc),
        'SmartDebtSettings: Pair does not exist'
      );
    });

    it('should fail if market IDs are the same', async () => {
      await expectThrow(
        trader.connect(core.governance).ownerRemoveSmartDebtPair(core.marketIds.usdc, core.marketIds.usdc),
        'SmartDebtSettings: Market IDs must be different'
      );
    });

    it('should fail if not owner', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).ownerRemoveSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerAddSmartCollateralPair', () => {
    it('should work normally', async () => {
      expect(await trader.isSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt)).to.be.false;
      expect(await trader.isSmartCollateralPair(core.marketIds.usdt, core.marketIds.usdc)).to.be.false;

      const res = await trader.connect(core.governance).ownerAddSmartCollateralPair(
        core.marketIds.usdc,
        core.marketIds.usdt
      );
      await expectEvent(trader, res, 'SmartCollateralPairAdded', {
        marketId1: core.marketIds.usdc,
        marketId2: core.marketIds.usdt
      });

      expect(await trader.isSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt)).to.be.true;
      expect(await trader.isSmartCollateralPair(core.marketIds.usdt, core.marketIds.usdc)).to.be.true;
    });

    it('should fail if pair already exists', async () => {
      await trader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt);
      await expectThrow(
        trader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt),
        'SmartDebtSettings: Pair already exists'
      );
      await expectThrow(
        trader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdt, core.marketIds.usdc),
        'SmartDebtSettings: Pair already exists'
      );
    });

    it('should fail if market IDs are the same', async () => {
      await expectThrow(
        trader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdc),
        'SmartDebtSettings: Market IDs must be different'
      );
    });

    it('should fail if not owner', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerRemoveSmartCollateralPair', () => {
    it('should work normally', async () => {
      await trader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt);
      expect(await trader.isSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt)).to.be.true;

      const res = await trader.connect(core.governance).ownerRemoveSmartCollateralPair(
        core.marketIds.usdc,
        core.marketIds.usdt
      );
      await expectEvent(trader, res, 'SmartCollateralPairRemoved', {
        marketId1: core.marketIds.usdc,
        marketId2: core.marketIds.usdt
      });

      expect(await trader.isSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt)).to.be.false;
      expect(await trader.isSmartCollateralPair(core.marketIds.usdt, core.marketIds.usdc)).to.be.false;
    });

    it('should fail if pair does not exist', async () => {
      await expectThrow(
        trader.connect(core.governance).ownerRemoveSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt),
        'SmartDebtSettings: Pair does not exist'
      );
      await expectThrow(
        trader.connect(core.governance).ownerRemoveSmartCollateralPair(core.marketIds.usdt, core.marketIds.usdc),
        'SmartDebtSettings: Pair does not exist'
      );
    });

    it('should fail if market IDs are the same', async () => {
      await expectThrow(
        trader.connect(core.governance).ownerRemoveSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdc),
        'SmartDebtSettings: Market IDs must be different'
      );
    });

    it('should fail if not owner', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).ownerRemoveSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerSetPairFeeSettings', async () => {
    it('should work normally', async () => {
      await trader.connect(core.governance).ownerSetGlobalFee({ value: parseEther('0.001') });
      await trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt);

      let pairFees = await trader.pairFees(USDC_USDT_PAIR_BYTES);
      expect(pairFees[1].value).to.equal(parseEther('0.001'));

      const res = await trader.connect(core.governance).ownerSetPairFeeSettings(
        core.marketIds.usdc,
        core.marketIds.usdt,
        {
          feeOverride: { value: parseEther('0.05') },
          depegThreshold: { value: parseEther('0.01') },
          slightThreshold: { value: parseEther('0.005') },
          feeCliffSeconds: 60,
          feeCompoundingInterval: 10
        }
      );
      await expectEvent(trader, res, 'PairFeeSettingsSet', {
        pairBytes: USDC_USDT_PAIR_BYTES,
      });
      const feeSettings = await trader.pairFeeSettings(USDC_USDT_PAIR_BYTES);
      expect(feeSettings.feeOverride.value).to.equal(parseEther('0.05'));
      expect(feeSettings.depegThreshold.value).to.equal(parseEther('0.01'));
      expect(feeSettings.slightThreshold.value).to.equal(parseEther('0.005'));
      expect(feeSettings.feeCliffSeconds).to.equal(60);
      expect(feeSettings.feeCompoundingInterval).to.equal(10);

      pairFees = await trader.pairFees(USDC_USDT_PAIR_BYTES);
      expect(pairFees[1].value).to.equal(parseEther('0.05'));
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).ownerSetPairFeeSettings(
          core.marketIds.usdc,
          core.marketIds.usdt,
          {
            feeOverride: { value: parseEther('0.05') },
            depegThreshold: { value: parseEther('0.01') },
            slightThreshold: { value: parseEther('0.005') },
            feeCliffSeconds: 60,
            feeCompoundingInterval: 10
          }
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerSetDepegFeePercentage', () => {
    it('should work normally', async () => {
      const res = await trader.connect(core.governance).ownerSetDepegFeePercentage({ value: parseEther('0.002') });
      await expectEvent(trader, res, 'DepegFeePercentageSet', {
        depegFeePercentage: { value: parseEther('0.002') }
      });
      expect((await trader.depegFeePercentage()).value).to.equal(parseEther('0.002'));
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).ownerSetDepegFeePercentage({ value: parseEther('0.002') }),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerSetSlightFeePercentage', () => {
    it('should work normally', async () => {
      const res = await trader.connect(core.governance).ownerSetSlightFeePercentage({ value: parseEther('0.002') });
      await expectEvent(trader, res, 'SlightFeePercentageSet', {
        slightFeePercentage: { value: parseEther('0.002') }
      });
      expect((await trader.slightFeePercentage()).value).to.equal(parseEther('0.002'));
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).ownerSetSlightFeePercentage({ value: parseEther('0.002') }),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });
});

async function expectEmptyPair(trader: TestSmartDebtSettings, user: string, accountNumber: number) {
  const pair = await trader.userToPair(user, accountNumber);
  expect(pair.pairType).to.equal(PairType.NONE);
  expect(pair.pairBytes).to.equal(BYTES_ZERO);
}

async function expectPair(
  trader: TestSmartDebtSettings,
  user: string,
  accountNumber: number,
  pairType: PairType,
  pairBytes: string,
  minExchangeRate: BigNumber = BigNumber.from(0),
  maxExchangeRate: BigNumber = BigNumber.from(0)
) {
  const pair = await trader.userToPair(user, accountNumber);
  expect(pair.pairType).to.equal(pairType);
  expect(pair.pairBytes).to.equal(pairBytes);
}
