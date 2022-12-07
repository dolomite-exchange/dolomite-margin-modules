// Utilities
import { address } from '@dolomite-margin/dist/src';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import axios from 'axios';
import { expect } from 'chai';
import { BaseContract, BigNumber, BigNumberish } from 'ethers';
import {
  ERC20,
  ERC20__factory,
  IDolomiteMargin,
  LiquidatorProxyV2WithExternalLiquidity,
  TestPriceOracle,
  TestPriceOracle__factory,
} from '../../../src/types';
import {
  AccountStruct,
  LIQUIDATOR_PROXY_V2,
  USDC,
  USDC_MARKET_ID,
  WETH,
  WETH_MARKET_ID,
} from '../../../src/utils/constants';
import {
  CoreProtocol,
  createContractWithAbi,
  depositIntoDolomiteMargin,
  owedWeiToHeldWei,
  setupCoreProtocol,
  setupWETHBalance,
  valueStructToBigNumber,
  withdrawFromDolomiteMargin,
} from '../../../src/utils/dolomite-utils';
import { NETWORK_ID, NO_EXPIRY } from '../../../src/utils/no-deps-constants';
import { getRealLatestBlockNumber, impersonate, revertToSnapshotAndCapture, snapshot } from '../../../src/utils/utils';

const API_URL = 'https://apiv5.paraswap.io';
const USDC_PRICE = BigNumber.from('1000000000000000000000000000000');
const solidNumber = '321';
const liquidNumber = '123';
const ONE_BPS = BigNumber.from('1');
const ONE_CENT = BigNumber.from('10000000000000000000000000000000000'); // $1 eq 1e36. Take off 2 decimals

describe('LiquidatorProxyV2WithExternalLiquidity', () => {
  let coreProtocol: CoreProtocol;
  let governance: SignerWithAddress;
  let solidAccount: SignerWithAddress;
  let liquidAccount: SignerWithAddress;
  let solidAccountStruct: AccountStruct;
  let liquidAccountStruct: AccountStruct;
  let dolomiteMargin: IDolomiteMargin;
  let liquidatorProxy: LiquidatorProxyV2WithExternalLiquidity;
  let testPriceOracle: TestPriceOracle;

  let snapshotId: string;

  async function expectBalance(accountStruct: AccountStruct, marketId: BigNumberish, expectedBalance: BigNumberish) {
    const balance = await dolomiteMargin.getAccountWei(accountStruct, marketId);
    expect(valueStructToBigNumber(balance))
      .to
      .eq(BigNumber.from(expectedBalance));
  }

  async function expectWalletBalanceOrDustyIfZero(wallet: address, token: address, expectedBalance: BigNumberish) {
    const contract = await new BaseContract(token, ERC20__factory.createInterface()) as ERC20;
    const balance = await contract.connect(coreProtocol.hhUser1).balanceOf(wallet);
    if (!balance.eq(expectedBalance) && BigNumber.from(expectedBalance).eq('0')) {
      // check the amount is dusty then (< $0.01)
      const price = await dolomiteMargin.getMarketPrice(await dolomiteMargin.getMarketIdByTokenAddress(token));
      const monetaryValue = price.value.mul(balance);
      expect(monetaryValue).to.be.lt(ONE_CENT);
    } else {
      expect(balance).to.eq(BigNumber.from(expectedBalance));
    }
  }

  async function expectBalanceIsGreaterThan(
    accountStruct: AccountStruct,
    marketId: BigNumberish,
    expectedBalance: BigNumberish,
    marginOfErrorBps: BigNumberish,
  ) {
    const expectedBalanceWithMarginOfError = BigNumber.from(expectedBalance)
      .sub(BigNumber.from(expectedBalance).mul(marginOfErrorBps).div('10000'));
    const balance = await dolomiteMargin.getAccountWei(accountStruct, marketId);
    expect(valueStructToBigNumber(balance))
      .to
      .gte(expectedBalanceWithMarginOfError);
  }

  before(async () => {
    const blockNumber = await getRealLatestBlockNumber(true);
    coreProtocol = await setupCoreProtocol({
      blockNumber,
    });
    governance = coreProtocol.governance;
    solidAccount = coreProtocol.hhUser1;
    liquidAccount = coreProtocol.hhUser2;
    solidAccountStruct = { owner: solidAccount.address, number: BigNumber.from(solidNumber) };
    liquidAccountStruct = { owner: liquidAccount.address, number: BigNumber.from(liquidNumber) };
    dolomiteMargin = coreProtocol.dolomiteMargin;
    liquidatorProxy = LIQUIDATOR_PROXY_V2.connect(solidAccount);
    const owner = await impersonate(governance.address, true);

    if (!(await dolomiteMargin.getIsGlobalOperator(liquidatorProxy.address))) {
      await dolomiteMargin.connect(owner).ownerSetGlobalOperator(liquidatorProxy.address, true);
      expect(await dolomiteMargin.getIsGlobalOperator(liquidatorProxy.address)).to.eql(true);
    }

    testPriceOracle = await createContractWithAbi<TestPriceOracle>(
      TestPriceOracle__factory.abi,
      TestPriceOracle__factory.bytecode,
      [],
    );
    await testPriceOracle.setPrice(USDC.address, USDC_PRICE);
    await dolomiteMargin.connect(owner).ownerSetPriceOracle(USDC_MARKET_ID, testPriceOracle.address);
    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#liquidate', () => {
    it('should work properly', async () => {
      const inputToken = {
        address: WETH.address,
        decimals: 18,
      };
      const outputToken = {
        address: USDC.address,
        decimals: 6,
      };

      await expectBalance(solidAccountStruct, WETH_MARKET_ID, 0);
      await expectBalance(solidAccountStruct, USDC_MARKET_ID, 0);

      const heldAmountWei = BigNumber.from('1000000000000000000'); // 1 ETH
      await setupWETHBalance(liquidAccount, heldAmountWei, dolomiteMargin);
      await depositIntoDolomiteMargin(liquidAccount, liquidNumber, WETH_MARKET_ID, heldAmountWei);
      await expectBalance(liquidAccountStruct, WETH_MARKET_ID, heldAmountWei);

      const owedAmountWei = (await dolomiteMargin.getAccountValues(liquidAccountStruct))[0]
        .value.div(USDC_PRICE).mul(100).div(125);
      // Decrease the user's collateralization to 125%
      await withdrawFromDolomiteMargin(liquidAccount, liquidNumber, USDC_MARKET_ID, owedAmountWei);
      await expectBalance(liquidAccountStruct, USDC_MARKET_ID, owedAmountWei.mul(-1));

      // Increase the user's debt by 10%, therefore lowering the collateralization to ~113% (making it under-water)
      await testPriceOracle.setPrice(USDC.address, USDC_PRICE.mul(11).div(10));

      const owedPriceAdj = (await dolomiteMargin.getMarketPrice(USDC_MARKET_ID)).value.mul(105).div(100);
      const heldPrice = (await dolomiteMargin.getMarketPrice(WETH_MARKET_ID)).value;
      const inputAmount = owedWeiToHeldWei(owedAmountWei, owedPriceAdj, heldPrice);
      const priceRouteResponse = await axios.get(`${API_URL}/prices`, {
        params: {
          network: NETWORK_ID,
          srcToken: inputToken.address,
          srcDecimals: inputToken.decimals.toString(),
          destToken: outputToken.address,
          destDecimals: outputToken.decimals.toString(),
          amount: inputAmount.toString(),
          includeContractMethods: 'simpleSwap,multiSwap,megaSwap',
        },
      })
        .then(response => response.data)
        .catch((error) => {
          console.error('Found error in prices', error);
          throw error;
        });

      const minOutputAmount = owedAmountWei;
      const queryParams = new URLSearchParams({
        ignoreChecks: 'true',
        ignoreGasEstimate: 'true',
        onlyParams: 'false',
      }).toString();
      const result = await axios.post(`${API_URL}/transactions/${NETWORK_ID}?${queryParams}`, {
        priceRoute: priceRouteResponse?.priceRoute,
        txOrigin: solidAccount.address,
        srcToken: inputToken.address,
        srcDecimals: inputToken.decimals,
        destToken: outputToken.address,
        destDecimals: outputToken.decimals,
        srcAmount: inputAmount.toString(),
        destAmount: minOutputAmount.toString(),
        userAddress: liquidatorProxy.address,
        receiver: liquidatorProxy.address,
      })
        .then(response => response.data)
        .catch((error) => {
          console.error('Found error in transactions', error);
          throw error;
        });

      console.log('\tLiquidating account:', liquidAccount.address);
      const txResult = await liquidatorProxy.liquidate(
        solidAccountStruct,
        liquidAccountStruct,
        USDC_MARKET_ID,
        WETH_MARKET_ID,
        NO_EXPIRY,
        result.data,
      );
      const receipt = await txResult.wait();
      console.log('\tliquidatorProxy#liquidate gas used:', receipt.gasUsed.toString());

      const outputAmount = BigNumber.from(priceRouteResponse.priceRoute.destAmount);
      await expectBalance(solidAccountStruct, WETH_MARKET_ID, 0);
      await expectBalanceIsGreaterThan(solidAccountStruct, USDC_MARKET_ID, outputAmount.sub(owedAmountWei), ONE_BPS);
      await expectBalanceIsGreaterThan(liquidAccountStruct, WETH_MARKET_ID, heldAmountWei.sub(inputAmount), ONE_BPS);
      await expectBalance(liquidAccountStruct, USDC_MARKET_ID, 0);

      await expectWalletBalanceOrDustyIfZero(liquidatorProxy.address, WETH.address, 0);
      await expectWalletBalanceOrDustyIfZero(liquidatorProxy.address, USDC.address, 0);
    });
  });
});
