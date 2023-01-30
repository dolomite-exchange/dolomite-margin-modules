import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  GLPWrappedTokenUserVaultFactory,
  GLPWrappedTokenUserVaultFactory__factory,
  GLPWrappedTokenUserVaultV1, GLPWrappedTokenUserVaultV1__factory,
} from '../../../src/types';
import {
  BORROW_POSITION_PROXY_V2,
  ES_GMX,
  GLP,
  GLP_MANAGER,
  GLP_REWARD_ROUTER, GMX,
  GMX_VAULT,
  S_GLP, V_GLP,
  WETH,
  WETH_MARKET_ID,
} from '../../../src/utils/constants';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { snapshot, revertToSnapshotAndCapture } from '../../utils';
import { expectEvent, expectThrow } from '../../utils/assertions';
import { CoreProtocol, setupCoreProtocol } from '../../utils/setup';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('GLPWrappedTokenUserVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let factory: GLPWrappedTokenUserVaultFactory;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 53107700,
    });
    const vaultImplementation = await createContractWithAbi<GLPWrappedTokenUserVaultV1>(
      GLPWrappedTokenUserVaultV1__factory.abi,
      GLPWrappedTokenUserVaultV1__factory.bytecode,
      []
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
        S_GLP.address,
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

  describe('#setGmx', () => {
    it('should work normally', async () => {
      const result = await factory.connect(core.governance).setGmx(OTHER_ADDRESS);
      await expectEvent(factory, result, 'GmxSet', {
        gmx: OTHER_ADDRESS,
      });
      expect(await factory.gmx()).to.equal(OTHER_ADDRESS);
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
  });

  describe('#setVGlp', () => {
    it('should work normally', async () => {
      const result = await factory.connect(core.governance).setVGlp(OTHER_ADDRESS);
      await expectEvent(factory, result, 'VGlpSet', {
        vGlp: OTHER_ADDRESS,
      });
      expect(await factory.vGlp()).to.equal(OTHER_ADDRESS);
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
  });

  describe('#allowablePositionMarketIds', () => {
    it('should work normally', async () => {
      expect(await factory.allowablePositionMarketIds()).to.equal([]);
    });
  });
});
