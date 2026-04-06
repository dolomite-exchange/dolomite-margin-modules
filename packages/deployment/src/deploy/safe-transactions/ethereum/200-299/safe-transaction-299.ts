import { AdminSetRiskParams__factory } from 'packages/admin/src/types';
import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network, ONE_BI } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  ALL_FUNCTIONS,
  encodeAddressForRole,
  encodeAddressToFunctionSelectorForRole,
  encodeGrantAdminRegistryPermissionIfNecessary,
  encodeGrantBypassTimelockAndExecutorRolesIfNecessary,
  encodeGrantRoleIfNecessary,
} from '../../../../utils/encoding/dolomite-owner-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { keccak256, toUtf8Bytes } from 'ethers/lib/utils';
import { BYTES_EMPTY } from '@dolomite-exchange/zap-sdk/dist/src/lib/Constants';
import { expect } from 'chai';

const SET_CATEGORIES_BY_MARKET_IDS_SELECTOR = keccak256(toUtf8Bytes('setCategoriesByMarketIds(uint256[],uint8[])')).slice(0, 10); // tslint-disable-line
const SET_CATEGORY_BY_MARKET_ID_SELECTOR = keccak256(toUtf8Bytes('setCategoryByMarketId(uint256,uint8)')).slice(0, 10);
const SET_CATEGORY_PARAM_SELECTOR = keccak256(toUtf8Bytes('setCategoryParam(uint8,(uint256),(uint256))')).slice(0, 10);
const SET_RISK_FEATURE_BY_MARKET_ID_SELECTOR = keccak256(toUtf8Bytes('setRiskFeatureByMarketId(uint256,uint8,bytes)')).slice(0, 10); // tslint-disable-line

const OWNER_SET_MAX_SUPPLY_WEI_SELECTOR = keccak256(toUtf8Bytes('ownerSetMaxSupplyWei(uint256,uint256)')).slice(0, 10);
const OWNER_SET_MAX_BORROW_WEI_SELECTOR = keccak256(toUtf8Bytes('ownerSetMaxBorrowWei(uint256,uint256)')).slice(0, 10);
const OWNER_SET_MARGIN_PREMIUM_SELECTOR = keccak256(toUtf8Bytes('ownerSetMarginPremium(uint256,(uint256))')).slice(0, 10); // tslint-disable-line
const OWNER_SET_LIQUIDATION_SPREAD_PREMIUM_SELECTOR = keccak256(toUtf8Bytes('ownerSetLiquidationSpreadPremium(uint256,(uint256))')).slice(0, 10); // tslint-disable-line

/**
 * This script encodes the following transactions:
 * - Deploys the admin set risk params contract
 */
async function main(): Promise<DryRunOutput<Network.Ethereum>> {
  const network = await getAndCheckSpecificNetwork(Network.Ethereum);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const adminSetRiskParamsAddress = await deployContractAndSave(
    'AdminSetRiskParams',
    [core.dolomiteAccountRiskOverrideSetter.address, core.adminRegistry.address, core.dolomiteMargin.address],
    'AdminSetRiskParamsV1'
  )
  const adminSetRiskParams = AdminSetRiskParams__factory.connect(
    adminSetRiskParamsAddress,
    core.hhUser1,
  );

  const adminSetRiskParamsRole = await adminSetRiskParams.ADMIN_SET_RISK_PARAMS_ROLE();
  const transactions: EncodedTransaction[] = [
    ...(await encodeGrantRoleIfNecessary(core, adminSetRiskParamsRole, adminSetRiskParams)),
    ...(await encodeGrantBypassTimelockAndExecutorRolesIfNecessary(core, adminSetRiskParams)),
    ...(await encodeAddressToFunctionSelectorForRole(
      core,
      adminSetRiskParamsRole,
      core.dolomiteMargin,
      core.dolomiteMargin.interface.getFunction('ownerSetMaxSupplyWei'),
    )),
    ...(await encodeAddressToFunctionSelectorForRole(
      core,
      adminSetRiskParamsRole,
      core.dolomiteMargin,
      core.dolomiteMargin.interface.getFunction('ownerSetMaxBorrowWei'),
    )),
    ...(await encodeAddressToFunctionSelectorForRole(
      core,
      adminSetRiskParamsRole,
      core.dolomiteMargin,
      core.dolomiteMargin.interface.getFunction('ownerSetMarginPremium'),
    )),
    ...(await encodeAddressToFunctionSelectorForRole(
      core,
      adminSetRiskParamsRole,
      core.dolomiteMargin,
      core.dolomiteMargin.interface.getFunction('ownerSetLiquidationSpreadPremium'),
    )),
    ...(await encodeAddressForRole( // @dev, adminSetRiskParams can call all functions on the dolomite risk override setter
      core,
      adminSetRiskParamsRole,
      core.dolomiteAccountRiskOverrideSetter
    )),
    ...(await encodeGrantAdminRegistryPermissionIfNecessary(
      core,
      core.adminRegistry,
      ALL_FUNCTIONS,
      adminSetRiskParams,
      core.gnosisSafe // @follow-up I assume you only want the gnosis safe to be able to call these functions?
    ))
  ];

  return {
    core,
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: core.network,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    scriptName: getScriptName(__filename),
    invariants: async () => {
      const setMaxSupplyData = await core.dolomiteMargin.populateTransaction.ownerSetMaxSupplyWei(core.marketIds.usd1, ONE_BI);
      assertHardhatInvariant(
        await core.ownerAdapterV2.isUserApprovedToSubmitTransaction(
          adminSetRiskParams.address,
          core.dolomiteMargin.address,
          setMaxSupplyData.data!.slice(0,10)
        ),
        'Admin risk setter is not approved for setting max supply wei'
      );

      const setMaxBorrowData = await core.dolomiteMargin.populateTransaction.ownerSetMaxBorrowWei(core.marketIds.usd1, ONE_BI);
      assertHardhatInvariant(
        await core.ownerAdapterV2.isUserApprovedToSubmitTransaction(
          adminSetRiskParams.address,
          core.dolomiteMargin.address,
          setMaxBorrowData.data!.slice(0,10)
        ),
        'Admin risk setter is not approved for setting max borrow wei'
      );

      const setMarginPremiumData = await core.dolomiteMargin.populateTransaction.ownerSetMarginPremium(core.marketIds.usd1, { value: ONE_BI });
      assertHardhatInvariant(
        await core.ownerAdapterV2.isUserApprovedToSubmitTransaction(
          adminSetRiskParams.address,
          core.dolomiteMargin.address,
          setMarginPremiumData.data!.slice(0,10)
        ),
        'Admin risk setter is not approved for setting market margin premium'
      );

      const setLiquidationPremiumData = await core.dolomiteMargin.populateTransaction.ownerSetLiquidationSpreadPremium(core.marketIds.usd1, { value: ONE_BI });
      assertHardhatInvariant(
        await core.ownerAdapterV2.isUserApprovedToSubmitTransaction(
          adminSetRiskParams.address,
          core.dolomiteMargin.address,
          setLiquidationPremiumData.data!.slice(0,10)
        ),
        'Admin risk setter is not approved for setting market liquidation premium'
      );

      const setCategoriesByMarketIdsData = await core.dolomiteAccountRiskOverrideSetter.populateTransaction.ownerSetCategoriesByMarketIds(
        [core.marketIds.usd1],
        [0]
      );
      assertHardhatInvariant(
        await core.ownerAdapterV2.isUserApprovedToSubmitTransaction(
          adminSetRiskParams.address,
          core.dolomiteAccountRiskOverrideSetter.address,
          setCategoriesByMarketIdsData.data!.slice(0,10)
        ),
        'Admin risk setter is not approved for setting category by market ids'
      );

      const setCategoryByMarketId = await core.dolomiteAccountRiskOverrideSetter.populateTransaction.ownerSetCategoryByMarketId(
        core.marketIds.usd1,
        0
      );
      assertHardhatInvariant(
        await core.ownerAdapterV2.isUserApprovedToSubmitTransaction(
          adminSetRiskParams.address,
          core.dolomiteAccountRiskOverrideSetter.address,
          setCategoryByMarketId.data!.slice(0,10)
        ),
        'Admin risk setter is not approved for setting category by market id'
      );

      const setCategoryParamData = await core.dolomiteAccountRiskOverrideSetter.populateTransaction.ownerSetCategoryParam(
        0,
        { value: ONE_BI },
        { value: ONE_BI },
      );
      assertHardhatInvariant(
        await core.ownerAdapterV2.isUserApprovedToSubmitTransaction(
          adminSetRiskParams.address,
          core.dolomiteAccountRiskOverrideSetter.address,
          setCategoryParamData.data!.slice(0,10)
        ),
        'Admin risk setter is not approved for setting category param'
      );

      const setRiskFeatureByMarketIdData = await core.dolomiteAccountRiskOverrideSetter.populateTransaction.ownerSetRiskFeatureByMarketId(
        core.marketIds.usd1,
        0,
        BYTES_EMPTY
      );
      assertHardhatInvariant(
        await core.ownerAdapterV2.isUserApprovedToSubmitTransaction(
          adminSetRiskParams.address,
          core.dolomiteAccountRiskOverrideSetter.address,
          setRiskFeatureByMarketIdData.data!.slice(0,10)
        ),
        'Admin risk setter is not approved for setting risk feature'
      );

      await expect(adminSetRiskParams.connect(core.hhUser1).setMarketMaxBorrowWei(core.marketIds.usd1, 10)).to.be.reverted;
    },
  };
}

doDryRunAndCheckDeployment(main);
