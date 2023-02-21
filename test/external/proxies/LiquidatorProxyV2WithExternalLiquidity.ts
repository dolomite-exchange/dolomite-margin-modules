// Utilities
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { sleep } from '@openzeppelin/upgrades';
import axios from 'axios';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  IDolomiteMargin,
  LiquidatorProxyV2WithExternalLiquidity,
  TestPriceOracle,
  TestPriceOracle__factory,
} from '../../../src/types';
import {
  AccountStruct,
} from '../../../src/utils/constants';
import {
  createContractWithAbi,
  depositIntoDolomiteMargin,
  owedWeiToHeldWei,
  withdrawFromDolomiteMargin,
} from '../../../src/utils/dolomite-utils';
import { NETWORK_ID, NO_EXPIRY } from '../../../src/utils/no-deps-constants';
import { getRealLatestBlockNumber, impersonate, resetFork, revertToSnapshotAndCapture, snapshot } from '../../utils';
import {
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
  expectWalletBalanceOrDustyIfZero,
} from '../../utils/assertions';
import { CoreProtocol, setupCoreProtocol, setupWETHBalance } from '../../utils/setup';

const API_URL = 'https://apiv5.paraswap.io';
const USDC_PRICE = BigNumber.from('1000000000000000000000000000000');
const solidNumber = '321';
const liquidNumber = '123';
const ONE_BPS = BigNumber.from('1');

describe('LiquidatorProxyV2WithExternalLiquidity', () => {
  let core: CoreProtocol;
  let governance: SignerWithAddress;
  let solidAccount: SignerWithAddress;
  let liquidAccount: SignerWithAddress;
  let solidAccountStruct: AccountStruct;
  let liquidAccountStruct: AccountStruct;
  let dolomiteMargin: IDolomiteMargin;
  let liquidatorProxy: LiquidatorProxyV2WithExternalLiquidity;
  let testPriceOracle: TestPriceOracle;

  let snapshotId: string;

  before(async () => {
    const blockNumber = await getRealLatestBlockNumber(true);
    core = await setupCoreProtocol({
      blockNumber,
    });
    governance = core.governance;
    solidAccount = core.hhUser1;
    liquidAccount = core.hhUser2;
    solidAccountStruct = { owner: solidAccount.address, number: BigNumber.from(solidNumber) };
    liquidAccountStruct = { owner: liquidAccount.address, number: BigNumber.from(liquidNumber) };
    dolomiteMargin = core.dolomiteMargin;
    liquidatorProxy = core.liquidatorProxyV2.connect(solidAccount);
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
    await testPriceOracle.setPrice(core.usdc.address, USDC_PRICE);
    await dolomiteMargin.connect(owner).ownerSetPriceOracle(core.marketIds.usdc, testPriceOracle.address);
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
      await setupWETHBalance(liquidAccount, heldAmountWei, dolomiteMargin);
      await depositIntoDolomiteMargin(liquidAccount, liquidNumber, core.marketIds.weth, heldAmountWei);
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
      await withdrawFromDolomiteMargin(liquidAccount, liquidNumber, core.marketIds.usdc, owedAmountWei);
      await expectProtocolBalance(
        core,
        liquidAccountStruct.owner,
        liquidAccountStruct.number,
        core.marketIds.usdc,
        owedAmountWei.mul(-1),
      );
      return { heldAmountWei, owedAmountWei, };
    }

    it('should work properly', async () => {
      const inputToken = {
        address: core.weth.address,
        decimals: 18,
      };
      const outputToken = {
        address: core.usdc.address,
        decimals: 6,
      };

      const { heldAmountWei, owedAmountWei } = await setupUserBalance();

      // Increase the user's debt by 10%, therefore lowering the collateralization to ~113% (making it under-water)
      await testPriceOracle.setPrice(core.usdc.address, USDC_PRICE.mul(11).div(10));

      const owedPriceAdj = (await dolomiteMargin.getMarketPrice(core.marketIds.usdc)).value.mul(105).div(100);
      const heldPrice = (await dolomiteMargin.getMarketPrice(core.marketIds.weth)).value;
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
        core.marketIds.usdc,
        core.marketIds.weth,
        NO_EXPIRY,
        result.data,
      );
      const receipt = await txResult.wait();
      console.log('\tliquidatorProxy#liquidate gas used:', receipt.gasUsed.toString());

      const outputAmount = BigNumber.from(priceRouteResponse.priceRoute.destAmount);
      await expectProtocolBalance(core, solidAccountStruct.owner, solidAccountStruct.number, core.marketIds.weth, 0);
      await expectProtocolBalanceIsGreaterThan(
        core,
        solidAccountStruct,
        core.marketIds.usdc,
        outputAmount.sub(owedAmountWei),
        ONE_BPS,
      );
      await expectProtocolBalanceIsGreaterThan(
        core,
        liquidAccountStruct,
        core.marketIds.weth,
        heldAmountWei.sub(inputAmount),
        ONE_BPS,
      );
      await expectProtocolBalance(
        core,
        liquidAccountStruct.owner,
        liquidAccountStruct.number,
        core.marketIds.usdc,
        0,
      );

      await expectWalletBalanceOrDustyIfZero(core, liquidatorProxy.address, core.weth.address, 0);
      await expectWalletBalanceOrDustyIfZero(core, liquidatorProxy.address, core.usdc.address, 0);
    });
  });
});
