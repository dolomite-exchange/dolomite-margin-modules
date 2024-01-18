// Utilities
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  IDolomiteMargin,
  ILiquidatorProxyV2WithExternalLiquidity,
  TestPriceOracle,
  TestPriceOracle__factory,
} from '../../../src/types';
import { AccountStruct } from '../../../src/utils/constants';
import {
  createContractWithAbi,
  depositIntoDolomiteMargin,
  owedWeiToHeldWei,
  withdrawFromDolomiteMargin,
} from '../../../src/utils/dolomite-utils';
import { Network, NO_EXPIRY } from '../../../src/utils/no-deps-constants';
import { getRealLatestBlockNumber, impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import {
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
  expectWalletBalanceOrDustyIfZero,
} from '../../utils/assertions';
import { CoreProtocol, setupCoreProtocol, setupWETHBalance } from '../../utils/setup';
import { getCalldataForParaswap } from '../../utils/trader-utils';

const USDC_PRICE = BigNumber.from('1000000000000000000000000000000');
const solidNumber = '321';
const liquidNumber = '123';
const FIFTY_BPS = BigNumber.from('50');

describe('LiquidatorProxyV2WithExternalLiquidity', () => {
  let core: CoreProtocol;
  let governance: SignerWithAddress;
  let solidAccount: SignerWithAddress;
  let liquidAccount: SignerWithAddress;
  let solidAccountStruct: AccountStruct;
  let liquidAccountStruct: AccountStruct;
  let dolomiteMargin: IDolomiteMargin;
  let liquidatorProxy: ILiquidatorProxyV2WithExternalLiquidity;
  let testPriceOracle: TestPriceOracle;

  let snapshotId: string;

  before(async () => {
    const blockNumber = await getRealLatestBlockNumber(true, Network.ArbitrumOne);
    core = await setupCoreProtocol({
      blockNumber,
      network: Network.ArbitrumOne,
    });
    governance = core.governance;
    solidAccount = core.hhUser1;
    liquidAccount = core.hhUser2;
    solidAccountStruct = { owner: solidAccount.address, number: BigNumber.from(solidNumber) };
    liquidAccountStruct = { owner: liquidAccount.address, number: BigNumber.from(liquidNumber) };
    dolomiteMargin = core.dolomiteMargin;
    liquidatorProxy = core.liquidatorProxyV2!.connect(solidAccount);
    const owner = await impersonate(governance.address, true);

    expect(await dolomiteMargin.getIsGlobalOperator(liquidatorProxy.address)).to.eql(true);

    testPriceOracle = await createContractWithAbi<TestPriceOracle>(
      TestPriceOracle__factory.abi,
      TestPriceOracle__factory.bytecode,
      [],
    );
    await testPriceOracle!.setPrice(core.tokens.usdc.address, USDC_PRICE);
    await dolomiteMargin.connect(owner).ownerSetPriceOracle(core.marketIds.usdc, testPriceOracle!.address);
    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#liquidate', () => {
    async function setupUserBalance(): Promise<{ heldAmountWei: BigNumber, owedAmountWei: BigNumber }> {
      await expectProtocolBalance(core, solidAccountStruct.owner, solidAccountStruct.number, core.marketIds.weth, 0);
      await expectProtocolBalance(core, solidAccountStruct.owner, solidAccountStruct.number, core.marketIds.usdc, 0);

      const heldAmountWei = BigNumber.from('1000000000000000000'); // 1 ETH
      await setupWETHBalance(core, liquidAccount, heldAmountWei, dolomiteMargin);
      await depositIntoDolomiteMargin(core, liquidAccount, liquidNumber, core.marketIds.weth, heldAmountWei);
      await expectProtocolBalance(
        core,
        liquidAccountStruct.owner,
        liquidAccountStruct.number,
        core.marketIds.weth,
        heldAmountWei,
      );

      const owedAmountWei = (await dolomiteMargin.getAccountValues(liquidAccountStruct))[0]
        .value.div(USDC_PRICE).mul(100).div(125);
      // Decrease the user's collateralization to 125%
      await withdrawFromDolomiteMargin(core, liquidAccount, liquidNumber, core.marketIds.usdc, owedAmountWei);
      await expectProtocolBalance(
        core,
        liquidAccountStruct.owner,
        liquidAccountStruct.number,
        core.marketIds.usdc,
        owedAmountWei.mul(-1),
      );
      return { heldAmountWei, owedAmountWei };
    }

    it('should work properly', async () => {
      const { heldAmountWei, owedAmountWei } = await setupUserBalance();

      // Increase the user's debt by 10%, therefore lowering the collateralization to ~113% (making it under-water)
      await testPriceOracle!.setPrice(core.tokens.usdc.address, USDC_PRICE.mul(11).div(10));

      const owedPriceAdj = (await dolomiteMargin.getMarketPrice(core.marketIds.usdc)).value.mul(105).div(100);
      const heldPrice = (await dolomiteMargin.getMarketPrice(core.marketIds.weth)).value;
      const inputAmount = owedWeiToHeldWei(owedAmountWei, owedPriceAdj, heldPrice);

      console.log('\tLiquidating account:', liquidAccount.address);

      const { calldata: paraswapCallData, outputAmount } = await getCalldataForParaswap(
        inputAmount,
        core.tokens.weth,
        18,
        owedAmountWei,
        core.tokens.usdc,
        6,
        solidAccount,
        liquidatorProxy,
        core,
      );

      const txResult = await liquidatorProxy.liquidate(
        solidAccountStruct,
        liquidAccountStruct,
        core.marketIds.usdc,
        core.marketIds.weth,
        NO_EXPIRY,
        paraswapCallData,
      );
      const receipt = await txResult.wait();
      console.log('\tliquidatorProxy#liquidate gas used:', receipt.gasUsed.toString());

      await expectProtocolBalance(core, solidAccountStruct.owner, solidAccountStruct.number, core.marketIds.weth, 0);
      await expectProtocolBalanceIsGreaterThan(
        core,
        solidAccountStruct,
        core.marketIds.usdc,
        outputAmount.sub(owedAmountWei),
        FIFTY_BPS,
      );
      await expectProtocolBalanceIsGreaterThan(
        core,
        liquidAccountStruct,
        core.marketIds.weth,
        heldAmountWei.sub(inputAmount),
        FIFTY_BPS,
      );
      await expectProtocolBalance(
        core,
        liquidAccountStruct.owner,
        liquidAccountStruct.number,
        core.marketIds.usdc,
        0,
      );

      await expectWalletBalanceOrDustyIfZero(core, liquidatorProxy.address, core.tokens.weth.address, 0);
      await expectWalletBalanceOrDustyIfZero(core, liquidatorProxy.address, core.tokens.usdc.address, 0);
    });
  });
});
