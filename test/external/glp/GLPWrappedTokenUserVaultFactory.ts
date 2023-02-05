import { expect } from 'chai';
import {
  GLPWrappedTokenUserVaultFactory,
  GLPWrappedTokenUserVaultFactory__factory,
  GLPWrappedTokenUserVaultV1,
  GLPWrappedTokenUserVaultV1__factory,
  GmxRegistryV1,
} from '../../../src/types';
import { WETH_MARKET_ID } from '../../../src/utils/constants';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectEvent, expectThrow } from '../../utils/assertions';
import { CoreProtocol, setupCoreProtocol, setupGmxRegistry } from '../../utils/setup';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('GLPWrappedTokenUserVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let gmxRegistry: GmxRegistryV1;
  let vaultImplementation: GLPWrappedTokenUserVaultV1;
  let factory: GLPWrappedTokenUserVaultFactory;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 53107700,
    });
    gmxRegistry = await setupGmxRegistry(core);
    vaultImplementation = await createContractWithAbi<GLPWrappedTokenUserVaultV1>(
      GLPWrappedTokenUserVaultV1__factory.abi,
      GLPWrappedTokenUserVaultV1__factory.bytecode,
      [],
    );
    factory = await createContractWithAbi<GLPWrappedTokenUserVaultFactory>(
      GLPWrappedTokenUserVaultFactory__factory.abi,
      GLPWrappedTokenUserVaultFactory__factory.bytecode,
      [
        core.weth.address,
        WETH_MARKET_ID,
        gmxRegistry.address,
        core.gmxEcosystem.fsGlp.address,
        core.borrowPositionProxyV2.address,
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
      expect(await factory.WETH()).to.equal(core.weth.address);
      expect(await factory.WETH_MARKET_ID()).to.equal(WETH_MARKET_ID);
      expect(await factory.gmxRegistry()).to.equal(gmxRegistry.address);
      expect(await factory.UNDERLYING_TOKEN()).to.equal(core.gmxEcosystem.fsGlp.address);
      expect(await factory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
      expect(await factory.userVaultImplementation()).to.equal(vaultImplementation.address);
      expect(await factory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#setGmxRegistry', () => {
    it('should work normally', async () => {
      const result = await factory.connect(core.governance).setGmxRegistry(OTHER_ADDRESS);
      await expectEvent(factory, result, 'GmxRegistrySet', {
        gmxRegistry: OTHER_ADDRESS,
      });
      expect(await factory.gmxRegistry()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).setGmxRegistry(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#allowableCollateralMarketIds', () => {
    it('should work normally', async () => {
      expect(await factory.allowableCollateralMarketIds()).to.deep.equal([]);
    });
  });

  describe('#allowableDebtMarketIds', () => {
    it('should work normally', async () => {
      expect(await factory.allowableDebtMarketIds()).to.deep.equal([]);
    });
  });
});
