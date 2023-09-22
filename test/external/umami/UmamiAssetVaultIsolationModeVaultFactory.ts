import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  IERC20,
  IUmamiAssetVault,
  IWETH,
  UmamiAssetVaultIsolationModeTokenVaultV1,
  UmamiAssetVaultIsolationModeTokenVaultV1__factory,
  UmamiAssetVaultIsolationModeVaultFactory,
  UmamiAssetVaultRegistry,
} from '../../../src/types';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { Network } from '../../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectEvent, expectThrow } from '../../utils/assertions';
import {
  createUmamiAssetVaultIsolationModeUnwrapperTraderV2,
  createUmamiAssetVaultIsolationModeVaultFactory,
  createUmamiAssetVaultIsolationModeWrapperTraderV2,
  createUmamiAssetVaultPriceOracle,
  createUmamiAssetVaultRegistry,
} from '../../utils/ecosystem-token-utils/umami';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol, setupTestMarket, setupUserVaultProxy } from '../../utils/setup';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

const underlyingMarketIds: BigNumber[] = [];
const vaults: UmamiAssetVaultIsolationModeTokenVaultV1[] = [];
const impersonatedWrappers: SignerWithAddress[] = [];
const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('UmamiAssetVaultIsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let umamiRegistry: UmamiAssetVaultRegistry;
  let userVaultImplementation: UmamiAssetVaultIsolationModeTokenVaultV1;
  let factories: UmamiAssetVaultIsolationModeVaultFactory[];
  let underlyingAssets: (IERC20 | IWETH)[];
  let umamiAssets: IUmamiAssetVault[];

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    umamiRegistry = await createUmamiAssetVaultRegistry(core);
    userVaultImplementation = await createContractWithAbi<UmamiAssetVaultIsolationModeTokenVaultV1>(
      UmamiAssetVaultIsolationModeTokenVaultV1__factory.abi,
      UmamiAssetVaultIsolationModeTokenVaultV1__factory.bytecode,
      [],
    );

    const umamiEcosystem = core.umamiEcosystem!;
    umamiAssets = [umamiEcosystem.glpLink, umamiEcosystem.glpUsdc, umamiEcosystem.glpWbtc, umamiEcosystem.glpWeth];
    underlyingAssets = [core.tokens.link, core.tokens.usdc, core.tokens.wbtc, core.tokens.weth];

    factories = await Promise.all(
      umamiAssets.map((asset) =>
        createUmamiAssetVaultIsolationModeVaultFactory(
          core,
          umamiRegistry,
          asset,
          userVaultImplementation,
        ),
      ),
    );
    for (let i = 0; i < factories.length; i++) {
      const factory = factories[i];
      const unwrapper = await createUmamiAssetVaultIsolationModeUnwrapperTraderV2(core, umamiRegistry, factory);
      const wrapper = await createUmamiAssetVaultIsolationModeWrapperTraderV2(core, umamiRegistry, factory);
      impersonatedWrappers.push(await impersonate(wrapper.address, true));
      const priceOracle = await createUmamiAssetVaultPriceOracle(core, umamiRegistry, factory);

      underlyingMarketIds.push(await core.dolomiteMargin.getNumMarkets());
      await setupTestMarket(core, factory, true, priceOracle);

      await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

      await factory.createVault(core.hhUser1.address);
      const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
      vaults.push(setupUserVaultProxy<UmamiAssetVaultIsolationModeTokenVaultV1>(
        vaultAddress,
        UmamiAssetVaultIsolationModeTokenVaultV1__factory,
        core.hhUser1
      ));
    }

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      for (let i = 0; i < factories.length; i++) {
        expect(await factories[i].umamiAssetVaultRegistry()).to.equal(umamiRegistry.address);
        expect(await factories[i].UNDERLYING_TOKEN()).to.equal(umamiAssets[i].address);
        expect(await factories[i].BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
        expect(await factories[i].userVaultImplementation()).to.equal(userVaultImplementation.address);
        expect(await factories[i].DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
      }
    });
  });

  describe('#ownerSetUmamiAssetVaultRegistry', () => {
    it('should work normally', async () => {
      for (let i = 0; i < factories.length; i++) {
        const result = await factories[i].connect(core.governance).ownerSetUmamiAssetVaultRegistry(OTHER_ADDRESS);
        await expectEvent(factories[i], result, 'UmamiAssetVaultRegistrySet', {
          umamiRegistry: OTHER_ADDRESS,
        });
        expect(await factories[i].umamiAssetVaultRegistry()).to.equal(OTHER_ADDRESS);
      }
    });

    it('should fail when not called by owner', async () => {
      for (let i = 0; i < factories.length; i++) {
        await expectThrow(
          factories[i].connect(core.hhUser1).ownerSetUmamiAssetVaultRegistry(OTHER_ADDRESS),
          `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
        );
      }
    });
  });

  describe('#setIsVaultFrozen', () => {
    it('should work normally', async () => {
      for (let i = 0; i < factories.length; i++) {
        expect(await vaults[i].isVaultFrozen()).to.eq(false);
        await factories[i].connect(impersonatedWrappers[i]).setIsVaultFrozen(vaults[i].address, true);
        expect(await vaults[i].isVaultFrozen()).to.eq(true);
      }
    });

    it('should fail if not token converter', async () => {
      for (let i = 0; i < factories.length; i++) {
        await expectThrow(
          factories[i].connect(core.hhUser1).setIsVaultFrozen(vaults[i].address, true),
          `IsolationModeVaultFactory: Caller is not a token converter <${core.hhUser1.address.toLowerCase()}>`,
        );
      }
    });

    it('should fail if invalid vault', async () => {
      for (let i = 0; i < factories.length; i++) {
        await expectThrow(
          factories[i].connect(impersonatedWrappers[i]).setIsVaultFrozen(core.hhUser1.address, false),
          `IsolationModeVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`,
        );
      }
    });
  });

  describe('#setShouldSkipTransfer', () => {
    it('should work normally', async () => {
      for (let i = 0; i < factories.length; i++) {
        expect(await vaults[i].isShouldSkipTransfer()).to.eq(false);
        await factories[i].connect(impersonatedWrappers[i]).setShouldSkipTransfer(vaults[i].address, true);
        expect(await vaults[i].isShouldSkipTransfer()).to.eq(true);
      }
    });

    it('should fail if not token converter', async () => {
      for (let i = 0; i < factories.length; i++) {
        await expectThrow(
          factories[i].connect(core.hhUser1).setShouldSkipTransfer(vaults[i].address, true),
          `IsolationModeVaultFactory: Caller is not a token converter <${core.hhUser1.address.toLowerCase()}>`,
        );
      }
    });

    it('should fail if invalid vault', async () => {
      for (let i = 0; i < factories.length; i++) {
        await expectThrow(
          factories[i].connect(impersonatedWrappers[i]).setShouldSkipTransfer(core.hhUser1.address, false),
          `IsolationModeVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`,
        );
      }
    });
  });

  describe('#allowableCollateralMarketIds', () => {
    it('should work normally', async () => {
      for (let i = 0; i < factories.length; i++) {
        const result = await factories[i].allowableCollateralMarketIds();
        expect(result.length).to.eql(1);
        expect(result[0]).to.eq(underlyingMarketIds[i]);
      }
    });
  });

  describe('#allowableDebtMarketIds', () => {
    it('should work normally', async () => {
      for (let i = 0; i < factories.length; i++) {
        const result = await factories[i].allowableDebtMarketIds();
        expect(result.length).to.eql(1);
        const marketId = await core.dolomiteMargin.getMarketIdByTokenAddress(underlyingAssets[i].address);
        expect(result[0]).to.eq(marketId);
      }
    });
  });
});
