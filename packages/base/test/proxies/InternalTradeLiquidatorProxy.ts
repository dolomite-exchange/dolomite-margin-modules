import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { InternalTradeLiquidatorProxy, InternalTradeLiquidatorProxy__factory, } from 'packages/base/src/types';
import {
  createContractWithAbi,
  depositIntoDolomiteMargin,
} from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../utils';
import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { createAndUpgradeDolomiteRegistry } from '../utils/dolomite';
import {
  disableInterestAccrual,
  setupCoreProtocol,
  setupDAIBalance,
  setupWETHBalance,
} from '../utils/setup';
import { BalanceCheckFlag } from '@dolomite-margin/dist/src/types';
import { expectProtocolBalance, expectThrow } from '../utils/assertions';

const amountWei = parseEther('1000');
const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = BigNumber.from('123');

describe('InternalTradeLiquidatorProxy', () => {

  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let liquidatorProxy: InternalTradeLiquidatorProxy;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 455_529_700,
    });

    await createAndUpgradeDolomiteRegistry(core);
    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.dai);

    liquidatorProxy = await createContractWithAbi<InternalTradeLiquidatorProxy>(
      InternalTradeLiquidatorProxy__factory.abi,
      InternalTradeLiquidatorProxy__factory.bytecode,
      [core.hhUser4.address, core.dolomiteMargin.address]
    );

    await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('500'));
    await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.dai.address, parseEther('1'));
    await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);
    await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.dai, core.testEcosystem!.testPriceOracle.address);

    await core.dolomiteMargin.ownerSetGlobalOperator(liquidatorProxy.address, true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await liquidatorProxy.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
      expect(await liquidatorProxy.handler()).to.equal(core.hhUser4.address);
    });
  });

  describe('#liquidate', () => {
    it('should work normally', async () => {
      await setupWETHBalance(core, core.hhUser4, ONE_ETH_BI, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser4, 0, core.marketIds.weth, ONE_ETH_BI);

      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('900'));
      await liquidatorProxy.connect(core.hhUser4).liquidate(
        { owner: core.hhUser4.address, number: defaultAccountNumber },
        { owner: core.hhUser1.address, number: borrowAccountNumber },
        core.marketIds.dai,
        core.marketIds.weth,
        ONE_ETH_BI,
        ONE_BI
      );
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, 0);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, parseEther('55'));
      await expectProtocolBalance(core, core.hhUser4, defaultAccountNumber, core.marketIds.weth, 0);
      await expectProtocolBalance(core, core.hhUser4, defaultAccountNumber, core.marketIds.dai, parseEther('945'));
    });

    it('should work when user does not have enough held wei for full reward', async () => {
      await setupWETHBalance(core, core.hhUser4, ONE_ETH_BI, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser4, 0, core.marketIds.weth, ONE_ETH_BI);

      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('1500'));
      await liquidatorProxy.connect(core.hhUser4).liquidate(
        { owner: core.hhUser4.address, number: defaultAccountNumber },
        { owner: core.hhUser1.address, number: borrowAccountNumber },
        core.marketIds.dai,
        core.marketIds.weth,
        ONE_ETH_BI,
        ONE_BI
      );
      // solid account gets full 1000 dai
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, 0);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, 0);
      await expectProtocolBalance(core, core.hhUser4, defaultAccountNumber, core.marketIds.weth, 0);
      await expectProtocolBalance(core, core.hhUser4, defaultAccountNumber, core.marketIds.dai, parseEther('1000'));
    });

    it('should fail if called with isolation mode market', async () => {
      await expectThrow(
        liquidatorProxy.connect(core.hhUser4).liquidate(
          { owner: core.hhUser4.address, number: defaultAccountNumber },
          { owner: core.hhUser1.address, number: borrowAccountNumber },
          core.marketIds.dArb,
          core.marketIds.weth,
          ONE_ETH_BI,
          ONE_BI
        ),
        'InternalTradeLiquidatorProxy: Invalid collateral market'
      );
      await expectThrow(
        liquidatorProxy.connect(core.hhUser4).liquidate(
          { owner: core.hhUser4.address, number: defaultAccountNumber },
          { owner: core.hhUser1.address, number: borrowAccountNumber },
          core.marketIds.dGmEth,
          core.marketIds.weth,
          ONE_ETH_BI,
          ONE_BI
        ),
        'InternalTradeLiquidatorProxy: Invalid collateral market'
      );
      await expectThrow(
        liquidatorProxy.connect(core.hhUser4).liquidate(
          { owner: core.hhUser4.address, number: defaultAccountNumber },
          { owner: core.hhUser1.address, number: borrowAccountNumber },
          core.marketIds.dfsGlp,
          core.marketIds.weth,
          ONE_ETH_BI,
          ONE_BI
        ),
        'InternalTradeLiquidatorProxy: Invalid collateral market'
      );
    });

    it('should fail if not called by handler', async () => {
      await expectThrow(
        liquidatorProxy.connect(core.hhUser1).liquidate(
          { owner: core.hhUser1.address, number: defaultAccountNumber },
          { owner: core.hhUser1.address, number: borrowAccountNumber },
          core.marketIds.dai,
          core.marketIds.weth,
          ONE_ETH_BI,
          ONE_BI,
        ),
        'InternalTradeLiquidatorProxy: Invalid sender',
      );
    });

    it('should fail if solid account is not hanlder', async () => {
      await expectThrow(
        liquidatorProxy.connect(core.hhUser4).liquidate(
          { owner: core.hhUser3.address, number: defaultAccountNumber },
          { owner: core.hhUser1.address, number: borrowAccountNumber },
          core.marketIds.dai,
          core.marketIds.weth,
          ONE_ETH_BI,
          ONE_BI,
        ),
        'InternalTradeLiquidatorProxy: Invalid sender',
      );
    });
  });

  describe('#getTradeCost', async () => {
    it('should fail if account is collateralized', async () => {
      await setupWETHBalance(core, core.hhUser4, ONE_ETH_BI, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser4, 0, core.marketIds.weth, ONE_ETH_BI);

      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      // At WETH price $500: supply = $1000 DAI, borrow = $500 WETH — account is healthy
      await expectThrow(
        liquidatorProxy.connect(core.hhUser4).liquidate(
          { owner: core.hhUser4.address, number: defaultAccountNumber },
          { owner: core.hhUser1.address, number: borrowAccountNumber },
          core.marketIds.dai,
          core.marketIds.weth,
          ONE_ETH_BI,
          ONE_BI,
        ),
        'InternalTradeLiquidatorProxy: Account is healthy',
      );
    });

    it('should fail if attempting to liquidate more debt than owed', async () => {
      await setupWETHBalance(core, core.hhUser4, ONE_ETH_BI, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser4, 0, core.marketIds.weth, ONE_ETH_BI);

      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('900'));

      await expectThrow(
        liquidatorProxy.connect(core.hhUser4).liquidate(
          { owner: core.hhUser4.address, number: defaultAccountNumber },
          { owner: core.hhUser1.address, number: borrowAccountNumber },
          core.marketIds.dai,
          core.marketIds.weth,
          parseEther('2'),
          ONE_BI,
        ),
        'InternalTradeLiquidatorProxy: Cannot overliquidate',
      );
    });

    it('should fail if reward is not greater than min output amount', async () => {
      await setupWETHBalance(core, core.hhUser4, ONE_ETH_BI, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser4, 0, core.marketIds.weth, ONE_ETH_BI);

      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('900'));

      await expectThrow(
        liquidatorProxy.connect(core.hhUser4).liquidate(
          { owner: core.hhUser4.address, number: defaultAccountNumber },
          { owner: core.hhUser1.address, number: borrowAccountNumber },
          core.marketIds.dai,
          core.marketIds.weth,
          ONE_ETH_BI,
          parseEther('1000'), // 1000 DAI min output, but reward is only 945 DAI
        ),
        'InternalTradeLiquidatorProxy: Insufficient output amount',
      );
    });

    it('should fail if not called by dolomite margin', async () => {
      await expectThrow(
        liquidatorProxy.connect(core.hhUser1).getTradeCost(
          core.marketIds.weth,
          core.marketIds.dai,
          { owner: core.hhUser1.address, number: borrowAccountNumber },
          { owner: core.hhUser4.address, number: defaultAccountNumber },
          { sign: false, value: ZERO_BI },
          { sign: false, value: ZERO_BI },
          { sign: true, value: ONE_ETH_BI },
          ethers.utils.defaultAbiCoder.encode(['uint256'], [ONE_BI]),
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if not called through proxy', async () => {
      const doloImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        liquidatorProxy.connect(doloImpersonator).getTradeCost(
          core.marketIds.weth,
          core.marketIds.dai,
          { owner: core.hhUser1.address, number: borrowAccountNumber },
          { owner: core.hhUser4.address, number: defaultAccountNumber },
          { sign: false, value: ZERO_BI },
          { sign: false, value: ZERO_BI },
          { sign: true, value: ONE_ETH_BI },
          ethers.utils.defaultAbiCoder.encode(['uint256'], [ONE_BI]),
        ),
        'InternalTradeLiquidatorProxy: Invalid caller',
      );
    });
  });

  describe('#ownerSetHandler', async () => {
    it('should work normally', async () => {
      expect(await liquidatorProxy.handler()).to.equal(core.hhUser4.address);
      await liquidatorProxy.connect(core.governance).ownerSetHandler(core.hhUser1.address);
      expect(await liquidatorProxy.handler()).to.equal(core.hhUser1.address);
    });

    it('should fail if zero address', async () => {
      await expectThrow(
        liquidatorProxy.connect(core.governance).ownerSetHandler(ADDRESS_ZERO),
        'InternalTradeLiquidatorProxy: Invalid handler',
      );
    });

    it('should fail not called by dolomite margin owner', async () => {
      await expectThrow(
        liquidatorProxy.connect(core.hhUser1).ownerSetHandler(core.hhUser2.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});
