import { expect } from 'chai';
import {
  GLPWrappedTokenUserVaultFactory,
  GLPWrappedTokenUserVaultFactory__factory,
  GLPWrappedTokenUserVaultV1,
  GLPWrappedTokenUserVaultV1__factory,
} from '../../../src/types';
import {
  BORROW_POSITION_PROXY_V2,
  ES_GMX,
  GLP_REWARD_ROUTER,
  GMX,
  FS_GLP,
  V_GLP,
  WETH,
  WETH_MARKET_ID,
} from '../../../src/utils/constants';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectEvent, expectThrow } from '../../utils/assertions';
import { CoreProtocol, setupCoreProtocol } from '../../utils/setup';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('GLPWrappedTokenUserVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let vaultImplementation: GLPWrappedTokenUserVaultV1;
  let factory: GLPWrappedTokenUserVaultFactory;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 53107700,
    });
    vaultImplementation = await createContractWithAbi<GLPWrappedTokenUserVaultV1>(
      GLPWrappedTokenUserVaultV1__factory.abi,
      GLPWrappedTokenUserVaultV1__factory.bytecode,
      [],
    );
    factory = await createContractWithAbi<GLPWrappedTokenUserVaultFactory>(
      GLPWrappedTokenUserVaultFactory__factory.abi,
      GLPWrappedTokenUserVaultFactory__factory.bytecode,
      [
        WETH.address,
        WETH_MARKET_ID,
        GLP_REWARD_ROUTER.address,
        GMX.address,
        ES_GMX.address,
        V_GLP.address,
        FS_GLP.address,
        BORROW_POSITION_PROXY_V2.address,
        vaultImplementation.address,
        core.dolomiteMargin.address,
      ],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await factory.WETH()).to.equal(WETH.address);
      expect(await factory.WETH_MARKET_ID()).to.equal(WETH_MARKET_ID);
      expect(await factory.glpRewardsRouter()).to.equal(GLP_REWARD_ROUTER.address);
      expect(await factory.gmx()).to.equal(GMX.address);
      expect(await factory.esGmx()).to.equal(ES_GMX.address);
      expect(await factory.vGlp()).to.equal(V_GLP.address);
      expect(await factory.UNDERLYING_TOKEN()).to.equal(FS_GLP.address);
      expect(await factory.BORROW_POSITION_PROXY()).to.equal(BORROW_POSITION_PROXY_V2.address);
      expect(await factory.userVaultImplementation()).to.equal(vaultImplementation.address);
      expect(await factory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#setGmx', () => {
    it('should work normally', async () => {
      const result = await factory.connect(core.governance).setGmx(OTHER_ADDRESS);
      await expectEvent(factory, result, 'GmxSet', {
        gmx: OTHER_ADDRESS,
      });
      expect(await factory.gmx()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).setGmx(OTHER_ADDRESS),
        `WrappedTokenUserVaultFactory: Caller is not the owner <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setEsGmx', () => {
    it('should work normally', async () => {
      const result = await factory.connect(core.governance).setEsGmx(OTHER_ADDRESS);
      await expectEvent(factory, result, 'EsGmxSet', {
        esGmx: OTHER_ADDRESS,
      });
      expect(await factory.esGmx()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).setEsGmx(OTHER_ADDRESS),
        `WrappedTokenUserVaultFactory: Caller is not the owner <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setVGlp', () => {
    it('should work normally', async () => {
      const result = await factory.connect(core.governance).setVGlp(OTHER_ADDRESS);
      await expectEvent(factory, result, 'VGlpSet', {
        vGlp: OTHER_ADDRESS,
      });
      expect(await factory.vGlp()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).setVGlp(OTHER_ADDRESS),
        `WrappedTokenUserVaultFactory: Caller is not the owner <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setGlpRewardsRouter', () => {
    it('should work normally', async () => {
      const result = await factory.connect(core.governance).setGlpRewardsRouter(OTHER_ADDRESS);
      await expectEvent(factory, result, 'GlpRewardsRouterSet', {
        glpRewardsRouter: OTHER_ADDRESS,
      });
      expect(await factory.glpRewardsRouter()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).setGlpRewardsRouter(OTHER_ADDRESS),
        `WrappedTokenUserVaultFactory: Caller is not the owner <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#allowablePositionMarketIds', () => {
    it('should work normally', async () => {
      expect(await factory.allowablePositionMarketIds()).to.deep.equal([]);
    });
  });
});
