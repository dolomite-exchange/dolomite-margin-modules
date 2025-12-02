import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import {
  ConstantPriceOracle,
  ConstantPriceOracle__factory,
} from '../src/types';
import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import {
  ADDRESS_ZERO,
  Network,
  ONE_ETH_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { CoreProtocolMantle } from 'packages/base/test/utils/core-protocols/core-protocol-mantle';

const ONE_DOLLAR = ONE_ETH_BI;
const FIFTY_CENTS = parseEther('0.5');

describe('ConstantPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolMantle;
  let oracle: ConstantPriceOracle;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 88_278_500,
      network: Network.Mantle,
    });

    oracle = await createContractWithAbi<ConstantPriceOracle>(
      ConstantPriceOracle__factory.abi,
      ConstantPriceOracle__factory.bytecode,
      [
        [core.tokens.usdy.address],
        [ONE_DOLLAR],
        core.dolomiteMargin.address,
      ],
    );

    await core.oracleAggregatorV2.ownerInsertOrUpdateToken({
      token: core.tokens.usdy.address,
      oracleInfos: [
        {
          oracle: oracle.address,
          tokenPair: ADDRESS_ZERO,
          weight: 100,
        },
      ],
      decimals: 18,
    });

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect((await oracle.getPrice(core.tokens.usdy.address)).value).to.eq(ONE_DOLLAR);
      expect((await core.oracleAggregatorV2.getPrice(core.tokens.usdy.address)).value).to.eq(ONE_DOLLAR);
      expect((await core.dolomiteMargin.getMarketPrice(core.marketIds.usdy)).value).to.eq(ONE_DOLLAR);

      expect(await oracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });

    it('should fail when token length is not aligned', async () => {
      await expectThrow(
        createContractWithAbi<ConstantPriceOracle>(
          ConstantPriceOracle__factory.abi,
          ConstantPriceOracle__factory.bytecode,
          [
            [core.tokens.usdy.address],
            [ONE_DOLLAR, ONE_DOLLAR],
            core.dolomiteMargin.address,
          ],
        ),
        'ConstantPriceOracle: Invalid tokens length',
      );
    });
  });

  describe('#ownerSetTokenPrice', () => {
    it('should work normally', async () => {
      expect((await oracle.getPrice(core.tokens.usdy.address)).value).to.eq(ONE_DOLLAR);

      const res = await oracle.connect(core.governance).ownerSetTokenPrice(core.tokens.usdy.address, FIFTY_CENTS);
      await expectEvent(oracle, res, 'TokenPriceSet', {
        token: core.tokens.usdy.address,
        price: FIFTY_CENTS,
      });
      expect((await oracle.getPrice(core.tokens.usdy.address)).value).to.eq(FIFTY_CENTS);
    });

    it('should fail if token is zero address', async () => {
      await expectThrow(
        oracle.connect(core.governance).ownerSetTokenPrice(ZERO_ADDRESS, FIFTY_CENTS),
        'ConstantPriceOracle: Invalid token',
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).ownerSetTokenPrice(core.tokens.usdy.address, FIFTY_CENTS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#getPrice', () => {
    it('should work normally', async () => {
      const price = await oracle.getPrice(core.tokens.usdy.address);
      expect(price.value).to.eq(ONE_DOLLAR);
    });

    it('should fail if token price is 0', async () => {
      await expectThrow(
        oracle.getPrice(core.tokens.weth.address),
        `ConstantPriceOracle: Invalid token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if caller is dolomite margin', async () => {
      const doloImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        oracle.connect(doloImpersonator).getPrice(core.tokens.usdy.address),
        'ConstantPriceOracle: DolomiteMargin cannot call',
      );
    });
  });
});
