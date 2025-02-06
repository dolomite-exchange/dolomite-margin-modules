import { IERC20 } from '@dolomite-exchange/modules-base/src/types';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import {
  depositIntoDolomiteMargin,
  getAndCheckSpecificNetwork,
} from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import {
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import { toZapBigNumber } from '@dolomite-exchange/modules-base/test/utils/liquidation-utils';
import {
  disableInterestAccrual,
  setupCoreProtocol,
  setupNativeUSDCBalance,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  getGLPPriceOracleV1ConstructorParams,
  getGLPUnwrapperTraderV2ConstructorParams,
  getGLPWrapperTraderV2ConstructorParams,
} from '@dolomite-exchange/modules-glp/src/glp-constructors';
import {
  getPendlePtIsolationModeUnwrapperTraderV3ConstructorParams,
  getPendlePtIsolationModeWrapperTraderV3ConstructorParams,
} from '@dolomite-exchange/modules-pendle/src/pendle-constructors';
import {
  IPendleGLPRegistry,
  IPendleRegistry,
  PendlePtIsolationModeTokenVaultV1__factory,
  PendlePtIsolationModeVaultFactory,
} from '@dolomite-exchange/modules-pendle/src/types';
import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { GenericEventEmissionType } from '@dolomite-margin/dist/src/modules/GenericTraderProxyV1';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { ADDRESS_ZERO, Network, ONE_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,

} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import Deployments from '../../../deployments.json';

interface Factory {
  pendleRegistry: IPendleRegistry | IPendleGLPRegistry;
  factory: PendlePtIsolationModeVaultFactory;
  underlyingToken: IERC20;
  oldWrapper: string;
  oldUnwrapper: string;
  newWrapper: string | undefined;
  newUnwrapper: string | undefined;
  rename: string;
  newVersion: 'V3' | 'V5';
}

/**
 * This script encodes the following transactions:
 * - Deploys PendleV3Router unwrapper and wrapper for the following markets:
 *      GLPMar2024
 *      rEthJun2025
 *      wstEthJun2024
 *      wstEthJun2025
 *      eEthApr2024
 *      ezEthJun2024
 * - Disables the old wrapper and unwrappers for those markets
 * - Enables the new wrapper and unwrappers for those markets
 * - Update pendle router
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions = [];
  const factories: Factory[] = [
    {
      pendleRegistry: core.pendleEcosystem.glpMar2024.pendleRegistry,
      factory: core.pendleEcosystem.glpMar2024.dPtGlpMar2024 as any,
      underlyingToken: core.tokens.dfsGlp,
      oldWrapper: Deployments.PendlePtGLPMar2024IsolationModeWrapperTraderV4[network].address,
      oldUnwrapper: Deployments.PendlePtGLPMar2024IsolationModeUnwrapperTraderV4[network].address,
      newWrapper: undefined,
      newUnwrapper: undefined,
      rename: 'GLPMar2024',
      newVersion: 'V5',
    },
    {
      pendleRegistry: core.pendleEcosystem.rEthJun2025.pendleRegistry,
      factory: core.pendleEcosystem.rEthJun2025.dPtREthJun2025,
      underlyingToken: core.tokens.rEth,
      oldWrapper: Deployments.PendlePtREthJun2025IsolationModeWrapperTraderV4[network].address,
      oldUnwrapper: Deployments.PendlePtREthJun2025IsolationModeUnwrapperTraderV4[network].address,
      newWrapper: undefined,
      newUnwrapper: undefined,
      rename: 'REthJun2025',
      newVersion: 'V5',
    },
    {
      pendleRegistry: core.pendleEcosystem.wstEthJun2024.pendleRegistry,
      factory: core.pendleEcosystem.wstEthJun2024.dPtWstEthJun2024,
      underlyingToken: core.tokens.wstEth,
      oldWrapper: Deployments.PendlePtWstEthJun2024IsolationModeWrapperTraderV4[network].address,
      oldUnwrapper: Deployments.PendlePtWstEthJun2024IsolationModeUnwrapperTraderV4[network].address,
      newWrapper: undefined,
      newUnwrapper: undefined,
      rename: 'WstEthJun2024',
      newVersion: 'V5',
    },
    {
      pendleRegistry: core.pendleEcosystem.wstEthJun2025.pendleRegistry,
      factory: core.pendleEcosystem.wstEthJun2025.dPtWstEthJun2025,
      underlyingToken: core.tokens.wstEth,
      oldWrapper: Deployments.PendlePtWstEthJun2025IsolationModeWrapperTraderV4[network].address,
      oldUnwrapper: Deployments.PendlePtWstEthJun2025IsolationModeUnwrapperTraderV4[network].address,
      newWrapper: undefined,
      newUnwrapper: undefined,
      rename: 'WstEthJun2025',
      newVersion: 'V5',
    },
    {
      pendleRegistry: core.pendleEcosystem.weEthApr2024.pendleRegistry,
      factory: core.pendleEcosystem.weEthApr2024.dPtWeEthApr2024,
      underlyingToken: core.tokens.weEth,
      oldWrapper: Deployments.PendlePtWeETHApr2024IsolationModeWrapperTraderV2[network].address,
      oldUnwrapper: Deployments.PendlePtWeETHApr2024IsolationModeUnwrapperTraderV2[network].address,
      newWrapper: undefined,
      newUnwrapper: undefined,
      rename: 'WeETHApr2024',
      newVersion: 'V3',
    },
    {
      pendleRegistry: core.pendleEcosystem.ezEthJun2024.pendleRegistry,
      factory: core.pendleEcosystem.ezEthJun2024.dPtEzEthJun2024,
      underlyingToken: core.tokens.ezEth,
      oldWrapper: Deployments.PendlePtEzETHJun2024IsolationModeWrapperTraderV2[network].address,
      oldUnwrapper: Deployments.PendlePtEzETHJun2024IsolationModeUnwrapperTraderV2[network].address,
      newWrapper: undefined,
      newUnwrapper: undefined,
      rename: 'EzETHJun2024',
      newVersion: 'V3',
    },
  ];

  await deployContractAndSave(
    'GLPUnwrapperTraderV2',
    getGLPUnwrapperTraderV2ConstructorParams(
      core,
      core.tokens.sGlp,
      core.gmxEcosystem.live.gmxRegistry,
    ),
    'GLPUnwrapperTraderV2',
  );

  await deployContractAndSave(
    'GLPWrapperTraderV2',
    getGLPWrapperTraderV2ConstructorParams(
      core,
      core.tokens.sGlp,
      core.gmxEcosystem.live.gmxRegistry,
    ),
    'GLPWrapperTraderV2',
  );

  const glpPriceOracleAddress = await deployContractAndSave(
    'GLPPriceOracleV1',
    getGLPPriceOracleV1ConstructorParams(
      core.tokens.sGlp,
      core.gmxEcosystem.live.gmxRegistry,
    ),
    'GLPPriceOracleV1',
  );

  for (let i = 0; i < factories.length; i++) {
    factories[i].newUnwrapper = await deployContractAndSave(
      'PendlePtIsolationModeUnwrapperTraderV3',
      getPendlePtIsolationModeUnwrapperTraderV3ConstructorParams(
        core,
        factories[i].pendleRegistry,
        factories[i].underlyingToken,
        factories[i].factory,
      ),
      `PendlePt${factories[i].rename}IsolationModeUnwrapperTrader${factories[i].newVersion}`,
    );

    factories[i].newWrapper = await deployContractAndSave(
      'PendlePtIsolationModeWrapperTraderV3',
      getPendlePtIsolationModeWrapperTraderV3ConstructorParams(
        core,
        factories[i].pendleRegistry,
        factories[i].underlyingToken,
        factories[i].factory,
      ),
      `PendlePt${factories[i].rename}IsolationModeWrapperTrader${factories[i].newVersion}`,
    );
  }

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracle: core.oracleAggregatorV2 },
      'oracle',
      'ownerInsertOrUpdateToken',
      [
        {
          decimals: 18,
          token: core.tokens.sGlp.address,
          oracleInfos: [
            {
              oracle: glpPriceOracleAddress,
              weight: 100,
              tokenPair: ADDRESS_ZERO,
            },
          ],
        },
      ],
    ),
    ...await encodeAddMarket(
      core,
      core.tokens.sGlp,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      ONE_BI,
      ZERO_BI,
      true,
    ),
  );

  for (let i = 0; i < factories.length; i++) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { factory: factories[i].factory },
        'factory',
        'ownerSetIsTokenConverterTrusted',
        [factories[i].oldWrapper, false],
      ),
    );
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { factory: factories[i].factory },
        'factory',
        'ownerSetIsTokenConverterTrusted',
        [factories[i].oldUnwrapper, false],
      ),
    );
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { factory: factories[i].factory },
        'factory',
        'ownerSetIsTokenConverterTrusted',
        [factories[i].newWrapper!, true],
      ),
    );
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { factory: factories[i].factory },
        'factory',
        'ownerSetIsTokenConverterTrusted',
        [factories[i].newUnwrapper!, true],
      ),
    );
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { pendleRegistry: factories[i].pendleRegistry },
        'pendleRegistry',
        'ownerSetPendleRouter',
        [core.pendleEcosystem.pendleRouterV3.address],
      ),
    );
  }

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    invariants: async () => {
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketIdByTokenAddress(core.tokens.sGlp.address)).eq(core.marketIds.sGlp),
        'Invalid market ID',
      );

      const glpPrice = (await core.dolomiteMargin.getMarketPrice(core.marketIds.sGlp)).value;
      assertHardhatInvariant(
        glpPrice.gt(parseEther('1.25')) && glpPrice.lt(parseEther('1.35')),
        `Invalid GLP price: ${glpPrice.toString()}`,
      );

      for (let i = 0; i < factories.length; i++) {
        assertHardhatInvariant(
          await factories[i].factory.isTokenConverterTrusted(factories[i].newWrapper!),
          'New wrapper is not trusted',
        );
        assertHardhatInvariant(
          await factories[i].factory.isTokenConverterTrusted(factories[i].newUnwrapper!),
          'New unwrapper is not trusted',
        );
        assertHardhatInvariant(
          !(await factories[i].factory.isTokenConverterTrusted(factories[i].oldWrapper)),
          'Old wrapper is trusted',
        );
        assertHardhatInvariant(
          !(await factories[i].factory.isTokenConverterTrusted(factories[i].oldUnwrapper)),
          'Old unwrapper is trusted',
        );
      }

      await core.pendleEcosystem.weEthApr2024.dPtWeEthApr2024.createVault(core.hhUser1.address);
      const vault = PendlePtIsolationModeTokenVaultV1__factory.connect(
        await core.pendleEcosystem.weEthApr2024.dPtWeEthApr2024.getVaultByAccount(core.hhUser1.address),
        core.hhUser1,
      );
      await disableInterestAccrual(core, core.marketIds.nativeUsdc);

      const defaultAccountNumber = '0';
      const borrowAccountNumber = '123123';
      const depositUsdcAmount = '101000000'; // $100
      const usdcAmount = '101000000'; // $100
      await setupNativeUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);

      console.log('\tDepositing USDC into Dolomite');
      await depositIntoDolomiteMargin(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.nativeUsdc,
        depositUsdcAmount,
      );
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.nativeUsdc,
        depositUsdcAmount,
      );

      console.log('\tTransferring USDC into vault');
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.nativeUsdc,
        usdcAmount,
        BalanceCheckFlag.Both,
      );

      console.log('\tGetting zap params');
      const params = await core.zap.getSwapExactTokensForTokensParams(
        {
          marketId: toZapBigNumber(core.marketIds.nativeUsdc),
          symbol: 'USDC',
        },
        toZapBigNumber(usdcAmount),
        {
          marketId: toZapBigNumber(core.marketIds.dPtWeEthApr2024),
          symbol: 'PT-eETH',
        },
        toZapBigNumber(ONE_BI),
        core.hhUser1.address,
        { slippageTolerance: 0.05 } // 5%
      );

      console.log('\tPerforming zap');
      await vault.swapExactInputForOutput(
        borrowAccountNumber,
        params[0].marketIdsPath.map(m => m.toFixed()),
        params[0].amountWeisPath[0].toFixed(),
        params[0].amountWeisPath[params[0].amountWeisPath.length - 1].toFixed(),
        params[0].traderParams,
        params[0].makerAccounts,
        {
          deadline: 12312312312,
          eventType: GenericEventEmissionType.None,
          balanceCheckFlag: BalanceCheckFlag.None,
        },
      );

      console.log('\tChecking balances after');
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.nativeUsdc, ZERO_BI);
      await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.nativeUsdc, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: vault.address, number: borrowAccountNumber },
        core.marketIds.dPtWeEthApr2024,
        parseEther('0.025'),
        ZERO_BI,
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
