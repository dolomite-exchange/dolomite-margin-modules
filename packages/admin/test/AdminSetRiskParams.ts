import { expect } from 'chai';
import { BytesLike } from 'ethers';
import { keccak256, parseEther, toUtf8Bytes } from 'ethers/lib/utils';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, BYTES_EMPTY, Network } from 'packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { AdminSetRiskParams, AdminSetRiskParams__factory } from '../src/types';
import { CoreProtocolEthereum } from 'packages/base/test/utils/core-protocols/core-protocol-ethereum';

const OTHER_ADDRESS = '0x1234567890123456789012345678901234567890';

enum Category {
  NONE,
  BERA,
  BTC,
  ETH,
  STABLE,
}

enum RiskFeature {
  NONE,
  BORROW_ONLY,
  SINGLE_COLLATERAL_WITH_STRICT_DEBT,
}

const SET_MARKET_MAX_SUPPLY_WEI_SELECTOR = keccak256(toUtf8Bytes('setMarketMaxSupplyWei(uint256,uint256)')).slice(0, 10);
const SET_MARKET_MAX_BORROW_WEI_SELECTOR = keccak256(toUtf8Bytes('setMarketMaxBorrowWei(uint256,uint256)')).slice(0, 10);
const SET_MARKET_MARGIN_PREMIUM_SELECTOR = keccak256(toUtf8Bytes('setMarketMarginPremium(uint256,(uint256))')).slice(0, 10); // tslint-disable-line
const SET_MARKET_LIQUIDATION_PREMIUM_SELECTOR = keccak256(toUtf8Bytes('setMarketLiquidationPremium(uint256,(uint256))')).slice(0, 10); // tslint-disable-line

const SET_CATEGORIES_BY_MARKET_IDS_SELECTOR = keccak256(toUtf8Bytes('setCategoriesByMarketIds(uint256[],uint8[])')).slice(0, 10); // tslint-disable-line
const SET_CATEGORY_BY_MARKET_ID_SELECTOR = keccak256(toUtf8Bytes('setCategoryByMarketId(uint256,uint8)')).slice(0, 10);
const SET_CATEGORY_PARAM_SELECTOR = keccak256(toUtf8Bytes('setCategoryParam(uint8,(uint256),(uint256))')).slice(0, 10);
const SET_RISK_FEATURE_BY_MARKET_ID_SELECTOR = keccak256(toUtf8Bytes('setRiskFeatureByMarketId(uint256,uint8,bytes)')).slice(0, 10); // tslint-disable-line

const OWNER_SET_MAX_SUPPLY_WEI_SELECTOR = keccak256(toUtf8Bytes('ownerSetMaxSupplyWei(uint256,uint256)')).slice(0, 10);
const OWNER_SET_MAX_BORROW_WEI_SELECTOR = keccak256(toUtf8Bytes('ownerSetMaxBorrowWei(uint256,uint256)')).slice(0, 10);
const OWNER_SET_MARGIN_PREMIUM_SELECTOR = keccak256(toUtf8Bytes('ownerSetMarginPremium(uint256,(uint256))')).slice(0, 10); // tslint-disable-line
const OWNER_SET_LIQUIDATION_SPREAD_PREMIUM_SELECTOR = keccak256(toUtf8Bytes('ownerSetLiquidationSpreadPremium(uint256,(uint256))')).slice(0, 10); // tslint-disable-line

describe('AdminSetRiskParams', () => {
  let snapshotId: string;

  let core: CoreProtocolEthereum;
  let bypassTimelockRole: BytesLike;
  let executorRole: BytesLike;

  let adminSetRiskParams: AdminSetRiskParams;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.Ethereum,
      blockNumber: 24_800_000,
    });

    adminSetRiskParams = await createContractWithAbi<AdminSetRiskParams>(
      AdminSetRiskParams__factory.abi,
      AdminSetRiskParams__factory.bytecode,
      [
        core.dolomiteAccountRiskOverrideSetter.address,
        core.adminRegistry.address,
        core.dolomiteMargin.address,
      ],
    );

    const adminSetRiskParamsRole = keccak256(toUtf8Bytes('ADMIN_SET_RISK_PARAMS_ROLE'));
    bypassTimelockRole = await core.ownerAdapterV2.BYPASS_TIMELOCK_ROLE();
    executorRole = await core.ownerAdapterV2.EXECUTOR_ROLE();

    await core.ownerAdapterV2.connect(core.governance).ownerAddRole(adminSetRiskParamsRole);
    await core.ownerAdapterV2.connect(core.governance).grantRole(
      adminSetRiskParamsRole,
      adminSetRiskParams.address
    );
    await core.ownerAdapterV2.connect(core.governance).grantRole(
      bypassTimelockRole,
      adminSetRiskParams.address
    );
    await core.ownerAdapterV2.connect(core.governance).grantRole(
      executorRole,
      adminSetRiskParams.address
    );

    await core.ownerAdapterV2.connect(core.governance).ownerAddRoleToAddressFunctionSelectors(
      adminSetRiskParamsRole,
      core.dolomiteMargin.address,
      [
        OWNER_SET_MAX_SUPPLY_WEI_SELECTOR,
        OWNER_SET_MAX_BORROW_WEI_SELECTOR,
        OWNER_SET_MARGIN_PREMIUM_SELECTOR,
        OWNER_SET_LIQUIDATION_SPREAD_PREMIUM_SELECTOR,
      ]
    );
    await core.ownerAdapterV2.connect(core.governance).ownerAddRoleAddresses(
      adminSetRiskParamsRole,
      [core.dolomiteAccountRiskOverrideSetter.address],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await adminSetRiskParams.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
      expect(await adminSetRiskParams.ADMIN_REGISTRY()).to.equal(core.adminRegistry.address);
      expect(await adminSetRiskParams.dolomiteAccountRiskOverride()).to.equal(
        core.dolomiteAccountRiskOverrideSetter.address
      );
    });
  });

  describe('#ownerSetDolomiteAccountRiskOverride', () => {
    it('should work normally', async () => {
      const res = await adminSetRiskParams.connect(core.governance).ownerSetDolomiteAccountRiskOverride(
        OTHER_ADDRESS
      );

      await expectEvent(adminSetRiskParams, res, 'DolomiteAccountRiskOverrideSet', {
        dolomiteAccountRiskOverride: OTHER_ADDRESS,
      });
      expect(await adminSetRiskParams.dolomiteAccountRiskOverride()).to.equal(OTHER_ADDRESS);
    });

    it('should fail if address is zero', async () => {
      await expectThrow(
        adminSetRiskParams.connect(core.governance).ownerSetDolomiteAccountRiskOverride(ADDRESS_ZERO),
        'AdminSetRiskParams: Invalid risk override setter'
      );
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        adminSetRiskParams.connect(core.hhUser1).ownerSetDolomiteAccountRiskOverride(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#setMarketMaxSupplyWei', () => {
    it('should work normally', async () => {
      await core.adminRegistry.connect(core.governance).grantPermission(
        SET_MARKET_MAX_SUPPLY_WEI_SELECTOR,
        adminSetRiskParams.address,
        core.hhUser4.address
      );

      const maxSupplyWei = parseEther('1000000');
      await adminSetRiskParams.connect(core.hhUser4).setMarketMaxSupplyWei(
        core.marketIds.usdc,
        maxSupplyWei
      );
      expect((await core.dolomiteMargin.getMarketMaxSupplyWei(core.marketIds.usdc)).value).to.equal(maxSupplyWei);
    });

    it('should fail when caller does not have permission', async () => {
      await expectThrow(
        adminSetRiskParams.connect(core.hhUser4).setMarketMaxSupplyWei(
          core.marketIds.usdc,
          parseEther('1000000')
        ),
        `AdminRegistryHelper: Caller does not have permission <${core.hhUser4.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setMarketMaxBorrowWei', () => {
    it('should work normally', async () => {
      await core.adminRegistry.connect(core.governance).grantPermission(
        SET_MARKET_MAX_BORROW_WEI_SELECTOR,
        adminSetRiskParams.address,
        core.hhUser4.address
      );

      const maxBorrowWei = parseEther('500000');
      await adminSetRiskParams.connect(core.hhUser4).setMarketMaxBorrowWei(
        core.marketIds.usdc,
        maxBorrowWei
      );
      expect((await core.dolomiteMargin.getMarketMaxBorrowWei(core.marketIds.usdc)).value).to.equal(maxBorrowWei);
    });

    it('should fail when caller does not have permission', async () => {
      await expectThrow(
        adminSetRiskParams.connect(core.hhUser4).setMarketMaxBorrowWei(
          core.marketIds.usdc,
          parseEther('500000')
        ),
        `AdminRegistryHelper: Caller does not have permission <${core.hhUser4.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setMarketMarginPremium', () => {
    it('should work normally', async () => {
      await core.adminRegistry.connect(core.governance).grantPermission(
        SET_MARKET_MARGIN_PREMIUM_SELECTOR,
        adminSetRiskParams.address,
        core.hhUser4.address
      );

      const marginPremium = { value: parseEther('0.10') }; // 10% premium
      await adminSetRiskParams.connect(core.hhUser4).setMarketMarginPremium(
        core.marketIds.usdc,
        marginPremium
      );
      expect((await core.dolomiteMargin.getMarketMarginPremium(core.marketIds.usdc)).value).to.equal(
        marginPremium.value
      );
    });

    it('should fail when caller does not have permission', async () => {
      await expectThrow(
        adminSetRiskParams.connect(core.hhUser4).setMarketMarginPremium(
          core.marketIds.usdc,
          { value: parseEther('0.10') }
        ),
        `AdminRegistryHelper: Caller does not have permission <${core.hhUser4.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setMarketLiquidationPremium', () => {
    it('should work normally', async () => {
      await core.adminRegistry.connect(core.governance).grantPermission(
        SET_MARKET_LIQUIDATION_PREMIUM_SELECTOR,
        adminSetRiskParams.address,
        core.hhUser4.address
      );

      const liquidationPremium = { value: parseEther('0.05') }; // 5% premium
      await adminSetRiskParams.connect(core.hhUser4).setMarketLiquidationPremium(
        core.marketIds.usdc,
        liquidationPremium
      );
      expect((await core.dolomiteMargin.getMarketLiquidationSpreadPremium(core.marketIds.usdc)).value).to.equal(
        liquidationPremium.value
      );
    });

    it('should fail when caller does not have permission', async () => {
      await expectThrow(
        adminSetRiskParams.connect(core.hhUser4).setMarketLiquidationPremium(
          core.marketIds.usdc,
          { value: parseEther('0.05') }
        ),
        `AdminRegistryHelper: Caller does not have permission <${core.hhUser4.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setCategoriesByMarketIds', () => {
    it('should work normally', async () => {
      await core.adminRegistry.connect(core.governance).grantPermission(
        SET_CATEGORIES_BY_MARKET_IDS_SELECTOR,
        adminSetRiskParams.address,
        core.hhUser4.address
      );

      const marketIds = [core.marketIds.usdc, core.marketIds.weth];
      const categories = [Category.STABLE, Category.ETH];
      await adminSetRiskParams.connect(core.hhUser4).setCategoriesByMarketIds(marketIds, categories);

      expect(await core.dolomiteAccountRiskOverrideSetter.getCategoryByMarketId(core.marketIds.usdc)).to.eq(
        Category.STABLE
      );
      expect(await core.dolomiteAccountRiskOverrideSetter.getCategoryByMarketId(core.marketIds.weth)).to.eq(
        Category.ETH
      );
    });

    it('should fail when caller does not have permission', async () => {
      await expectThrow(
        adminSetRiskParams.connect(core.hhUser4).setCategoriesByMarketIds(
          [core.marketIds.usdc],
          [Category.STABLE]
        ),
        `AdminRegistryHelper: Caller does not have permission <${core.hhUser4.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setCategoryByMarketId', () => {
    it('should work normally', async () => {
      await core.adminRegistry.connect(core.governance).grantPermission(
        SET_CATEGORY_BY_MARKET_ID_SELECTOR,
        adminSetRiskParams.address,
        core.hhUser4.address
      );

      await adminSetRiskParams.connect(core.hhUser4).setCategoryByMarketId(core.marketIds.usdc, Category.STABLE);
      expect(await core.dolomiteAccountRiskOverrideSetter.getCategoryByMarketId(core.marketIds.usdc)).to.eq(
        Category.STABLE
      );
    });

    it('should fail when caller does not have permission', async () => {
      await expectThrow(
        adminSetRiskParams.connect(core.hhUser4).setCategoryByMarketId(core.marketIds.usdc, Category.STABLE),
        `AdminRegistryHelper: Caller does not have permission <${core.hhUser4.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setCategoryParam', () => {
    it('should work normally', async () => {
      await core.adminRegistry.connect(core.governance).grantPermission(
        SET_CATEGORY_PARAM_SELECTOR,
        adminSetRiskParams.address,
        core.hhUser4.address
      );

      const marginRatioOverride = { value: parseEther('0.5') };
      const liquidationRewardOverride = { value: parseEther('0.05') };
      await adminSetRiskParams.connect(core.hhUser4).setCategoryParam(
        Category.STABLE,
        marginRatioOverride,
        liquidationRewardOverride
      );

      const categoryStruct = await core.dolomiteAccountRiskOverrideSetter.getCategoryParamByCategory(Category.STABLE);
      expect(categoryStruct.category).to.eq(Category.STABLE);
      expect(categoryStruct.marginRatioOverride.value).to.eq(marginRatioOverride.value);
      expect(categoryStruct.liquidationRewardOverride.value).to.eq(liquidationRewardOverride.value);
    });

    it('should fail when caller does not have permission', async () => {
      await expectThrow(
        adminSetRiskParams.connect(core.hhUser4).setCategoryParam(
          Category.STABLE,
          { value: parseEther('0.5') },
          { value: parseEther('0.05') }
        ),
        `AdminRegistryHelper: Caller does not have permission <${core.hhUser4.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setRiskFeatureByMarketId', () => {
    it('should work normally', async () => {
      await core.adminRegistry.connect(core.governance).grantPermission(
        SET_RISK_FEATURE_BY_MARKET_ID_SELECTOR,
        adminSetRiskParams.address,
        core.hhUser4.address
      );

      await adminSetRiskParams.connect(core.hhUser4).setRiskFeatureByMarketId(
        core.marketIds.usdc,
        RiskFeature.BORROW_ONLY,
        BYTES_EMPTY
      );
      expect(await core.dolomiteAccountRiskOverrideSetter.getRiskFeatureByMarketId(core.marketIds.usdc)).to.eq(
        RiskFeature.BORROW_ONLY
      );
    });

    it('should fail when caller does not have permission', async () => {
      await expectThrow(
        adminSetRiskParams.connect(core.hhUser4).setRiskFeatureByMarketId(
          core.marketIds.usdc,
          RiskFeature.BORROW_ONLY,
          BYTES_EMPTY
        ),
        `AdminRegistryHelper: Caller does not have permission <${core.hhUser4.address.toLowerCase()}>`,
      );
    });
  });
});
