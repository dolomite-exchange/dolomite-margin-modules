import { expect } from 'chai';
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
import { Network, NONE_MARKET_ID } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectEvent, expectThrow } from '../../utils/assertions';
import {
  createUmamiAssetVaultIsolationModeVaultFactory,
  createUmamiAssetVaultRegistry,
} from '../../utils/ecosystem-token-utils/umami';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from '../../utils/setup';

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

  describe('#allowableCollateralMarketIds', () => {
    it('should work normally', async () => {
      for (let i = 0; i < factories.length; i++) {
        const result = await factories[i].allowableCollateralMarketIds();
        expect(result.length).to.eql(1);
        expect(result[0]).to.eq(NONE_MARKET_ID);
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
