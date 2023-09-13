import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import {
  GmxRegistryV2,
  GmxV2IsolationModeTokenVaultV1,
  GmxV2IsolationModeTokenVaultV1__factory,
  GmxV2IsolationModeUnwrapperTraderV2,
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeWrapperTraderV2,
  GmxV2MarketTokenPriceOracle,
  IGmxMarketToken,
} from 'src/types';
import { depositIntoDolomiteMargin } from 'src/utils/dolomite-utils';
import { Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from 'src/utils/no-deps-constants';
import { getRealLatestBlockNumber, impersonate, revertToSnapshotAndCapture, snapshot } from 'test/utils';
import { expectProtocolBalance, expectThrow } from 'test/utils/assertions';
import {
  createGmxRegistryV2,
  createGmxV2IsolationModeTokenVaultV1,
  createGmxV2IsolationModeUnwrapperTraderV2,
  createGmxV2IsolationModeVaultFactory,
  createGmxV2IsolationModeWrapperTraderV2,
  createGmxV2MarketTokenPriceOracle,
} from 'test/utils/ecosystem-token-utils/gmx';
import {
  CoreProtocol,
  disableInterestAccrual,
  setupCoreProtocol,
  setupGMBalance,
  setupNativeUSDCBalance,
  setupTestMarket,
  setupUserVaultProxy,
  setupWETHBalance,
} from 'test/utils/setup';

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const DUMMY_WITHDRAWAL_KEY = '0x6d1ff6ffcab884211992a9d6b8261b7fae5db4d2da3a5eb58647988da3869d6f';
const CALLBACK_GAS_LIMIT = BigNumber.from('1500000');
const usdcAmount = BigNumber.from('1000000000'); // $1000
const amountWei = parseEther('1');

describe('GmxV2IsolationModeUnwrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IGmxMarketToken;
  let allowableMarketIds: BigNumberish[];
  let gmxRegistryV2: GmxRegistryV2;
  let unwrapper: GmxV2IsolationModeUnwrapperTraderV2;
  let wrapper: GmxV2IsolationModeWrapperTraderV2;
  let factory: GmxV2IsolationModeVaultFactory;
  let vault: GmxV2IsolationModeTokenVaultV1;
  let priceOracle: GmxV2MarketTokenPriceOracle;
  let marketId: BigNumber;

  before(async () => {
    const latestBlockNumber = await getRealLatestBlockNumber(true, Network.ArbitrumOne);
    core = await setupCoreProtocol({
      blockNumber: latestBlockNumber,
      network: Network.ArbitrumOne,
    });
    underlyingToken = core.gmxEcosystemV2!.gmxEthUsdMarketToken.connect(core.hhUser1);
    const userVaultImplementation = await createGmxV2IsolationModeTokenVaultV1(core);
    gmxRegistryV2 = await createGmxRegistryV2(core);

    allowableMarketIds = [core.marketIds.nativeUsdc!, core.marketIds.weth];
    factory = await createGmxV2IsolationModeVaultFactory(
      core,
      gmxRegistryV2,
      allowableMarketIds,
      allowableMarketIds,
      core.gmxEcosystemV2!.gmxEthUsdMarketToken,
      userVaultImplementation,
    );
    wrapper = await createGmxV2IsolationModeWrapperTraderV2(core, factory, gmxRegistryV2);
    unwrapper = await createGmxV2IsolationModeUnwrapperTraderV2(core, factory, gmxRegistryV2);
    await gmxRegistryV2.connect(core.governance).ownerSetGmxV2UnwrapperTrader(unwrapper.address);
    await gmxRegistryV2.connect(core.governance).ownerSetGmxV2WrapperTrader(wrapper.address);
    priceOracle = await createGmxV2MarketTokenPriceOracle(core, gmxRegistryV2);
    await priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);

    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.nativeUsdc!);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<GmxV2IsolationModeTokenVaultV1>(
      vaultAddress,
      GmxV2IsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    await setupWETHBalance(core, core.hhUser1, ONE_ETH_BI, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ONE_ETH_BI);

    await setupNativeUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.nativeUsdc!, usdcAmount);
    await unwrapper.connect(core.governance).ownerSetIsHandler(core.gmxEcosystemV2!.gmxDepositHandler.address, true);
    await unwrapper.connect(core.governance).ownerSetIsHandler(core.gmxEcosystemV2!.gmxWithdrawalHandler.address, true);
    await unwrapper.connect(core.governance).ownerSetCallbackGasLimit(CALLBACK_GAS_LIMIT);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initializer', () => {
    it('should work normally', async () => {
      expect(await unwrapper.GMX_REGISTRY_V2()).to.eq(gmxRegistryV2.address);
    });
  });

  describe('#afterWithdrawalCancellation', () => {
    it('should work normally', async () => {
      await setupGMBalance(core, core.hhUser1.address, amountWei, vault);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);

      await expect(() => vault.connect(core.hhUser1).initiateUnwrapping(
        defaultAccountNumber,
        amountWei,
        core.tokens.weth.address,
        ONE_BI,
        { value: parseEther('.01') },
      )).to.changeTokenBalance(underlyingToken, vault, ZERO_BI.sub(amountWei));

      const filter = unwrapper.filters.WithdrawalCreated();
      const withdrawalKey = (await unwrapper.queryFilter(filter))[0].args.key;

      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);

      // Mine blocks so we can cancel deposit
      await mineBlocks(1200);
      await vault.connect(core.hhUser1).cancelWithdrawal(withdrawalKey);

      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, core.marketIds.weth, 0);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(amountWei);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
    });

    it('should fail when not called by valid handler', async () => {
      const withdrawalInfo = getWithdrawalObject(
        unwrapper.address,
        underlyingToken.address,
        ONE_BI,
        ONE_BI,
        amountWei,
        parseEther('.01'),
        core.tokens.nativeUsdc!.address,
        core.tokens.weth.address,
      );
      await expectThrow(
        unwrapper.connect(core.hhUser1).afterWithdrawalCancellation(
          DUMMY_WITHDRAWAL_KEY,
          withdrawalInfo.withdrawal,
          withdrawalInfo.eventData,
        ),
        `GmxV2IsolationModeTraderBase: Only handler can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when withdrawal was not created through token vault', async () => {
      const withdrawalExecutor = await impersonate(core.gmxEcosystemV2!.gmxWithdrawalHandler.address, true);
      const withdrawalInfo = getWithdrawalObject(
        unwrapper.address,
        underlyingToken.address,
        ONE_BI,
        ONE_BI,
        amountWei,
        parseEther('.01'),
        core.tokens.weth.address,
        core.tokens.nativeUsdc!.address,
      );
      await expectThrow(
        unwrapper.connect(withdrawalExecutor).afterWithdrawalCancellation(
          DUMMY_WITHDRAWAL_KEY,
          withdrawalInfo.withdrawal,
          withdrawalInfo.eventData,
        ),
        'GmxV2IsolationModeUnwrapperV2: Invalid withdrawal key',
      );
    });
  });

  describe.only('afterWithdrawalExecution', () => {
    it('should work normally', async () => {
      await setupGMBalance(core, core.hhUser1.address, amountWei.mul(2), vault);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei.mul(2));
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei.mul(2));
      await vault.transferIntoPositionWithUnderlyingToken(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei.mul(2),
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei.mul(2));

      await expect(() => vault.connect(core.hhUser1).initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.nativeUsdc!.address,
        ONE_BI,
        { value: parseEther('.01') },
      )).to.changeTokenBalance(underlyingToken, vault, ZERO_BI.sub(amountWei));

      const filter = unwrapper.filters.WithdrawalCreated();
      const withdrawalKey = (await unwrapper.queryFilter(filter))[0].args.key;

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei.mul(2));
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(amountWei);

      const withdrawalExecutor = await impersonate(core.gmxEcosystemV2!.gmxWithdrawalHandler.address, true);
      const unwrapperImpersonate = await impersonate(unwrapper.address, true);
      await setupNativeUSDCBalance(core, unwrapperImpersonate, 100e6, core.gmxEcosystem!.esGmxDistributor);
      const withdrawalInfo = getWithdrawalObject(
        unwrapper.address,
        underlyingToken.address,
        ONE_BI,
        ONE_BI,
        amountWei,
        parseEther('.01'),
        core.tokens.nativeUsdc!.address,
        core.tokens.weth.address,
        BigNumber.from('100000000'),
      );
      await unwrapper.connect(withdrawalExecutor).afterWithdrawalExecution(
        withdrawalKey,
        withdrawalInfo.withdrawal,
        withdrawalInfo.eventData,
      );

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc!, 100e6);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(amountWei);
    });

    it('should fail when not called by valid handler', async () => {
      const withdrawalInfo = getWithdrawalObject(
        unwrapper.address,
        underlyingToken.address,
        ONE_BI,
        ONE_BI,
        amountWei,
        parseEther('.01'),
        core.tokens.nativeUsdc!.address,
        core.tokens.weth.address,
      );
      await expectThrow(
        unwrapper.connect(core.hhUser1).afterWithdrawalExecution(
          DUMMY_WITHDRAWAL_KEY,
          withdrawalInfo.withdrawal,
          withdrawalInfo.eventData,
        ),
        `GmxV2IsolationModeTraderBase: Only handler can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when withdrawal was not created through token vault', async () => {
      const withdrawalExecutor = await impersonate(core.gmxEcosystemV2!.gmxWithdrawalHandler.address, true);
      const withdrawalInfo = getWithdrawalObject(
        unwrapper.address,
        underlyingToken.address,
        ONE_BI,
        ONE_BI,
        amountWei,
        parseEther('.01'),
        core.tokens.weth.address,
        core.tokens.nativeUsdc!.address,
      );
      await expectThrow(
        unwrapper.connect(withdrawalExecutor).afterWithdrawalExecution(
          DUMMY_WITHDRAWAL_KEY,
          withdrawalInfo.withdrawal,
          withdrawalInfo.eventData,
        ),
        'GmxV2IsolationModeUnwrapperV2: Invalid withdrawal key',
      );
    });
  });
});

async function mineBlocks(blockNumber: number) {
  let i = blockNumber;
  while (i > 0) {
    await ethers.provider.send('evm_mine', []);
    i--;
  }
}

function getWithdrawalObject(
  unwrapper: string,
  marketToken: string,
  minLongTokenAmount: BigNumber,
  minShortTokenAmount: BigNumber,
  marketTokenAmount: BigNumber,
  executionFee: BigNumber,
  outputToken: string,
  secondaryOutputToken: string,
  outputAmount: BigNumber = BigNumber.from('0'),
  secondaryOutputAmount: BigNumber = BigNumber.from('0'),
) {
  const withdrawal = {
    addresses: {
      account: unwrapper,
      receiver: unwrapper,
      callbackContract: unwrapper,
      uiFeeReceiver: ZERO_ADDRESS,
      market: marketToken,
      longTokenSwapPath: [],
      shortTokenSwapPath: [],
    },
    numbers: {
      executionFee,
      marketTokenAmount,
      minLongTokenAmount,
      minShortTokenAmount,
      updatedAtBlock: 123123123,
      callbackGasLimit: CALLBACK_GAS_LIMIT,
    },
    flags: {
      shouldUnwrapNativeToken: false,
    },
  };

  let eventData;
  if (outputAmount.eq(0) && secondaryOutputAmount.eq(0)) {
    eventData = {
      addressItems: {
        items: [],
        arrayItems: [],
      },
      uintItems: {
        items: [],
        arrayItems: [],
      },
      intItems: {
        items: [],
        arrayItems: [],
      },
      boolItems: {
        items: [],
        arrayItems: [],
      },
      bytes32Items: {
        items: [],
        arrayItems: [],
      },
      bytesItems: {
        items: [],
        arrayItems: [],
      },
      stringItems: {
        items: [],
        arrayItems: [],
      },
    };
  } else {
    eventData = {
      addressItems: {
        items: [
          {
            key: 'outputToken',
            value: outputToken,
          },
          {
            key: 'secondaryOutputToken',
            value: secondaryOutputToken,
          },
        ],
        arrayItems: [],
      },
      uintItems: {
        items: [
          {
            key: 'outputAmount',
            value: outputAmount,
          },
          {
            key: 'secondaryOutputAmount',
            value: secondaryOutputAmount,
          },
        ],
        arrayItems: [],
      },
      intItems: {
        items: [],
        arrayItems: [],
      },
      boolItems: {
        items: [],
        arrayItems: [],
      },
      bytes32Items: {
        items: [],
        arrayItems: [],
      },
      bytesItems: {
        items: [],
        arrayItems: [],
      },
      stringItems: {
        items: [],
        arrayItems: [],
      },
    };
  }
  return { withdrawal, eventData };
}
