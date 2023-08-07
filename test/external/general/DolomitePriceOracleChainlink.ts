import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from '../../utils/setup';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Network } from '../../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import {
  CustomTestToken,
  TestDolomitePriceOracleChainlink,
  TestDolomitePriceOracleChainlink__factory
} from '../../../src/types';
import { createContractWithAbi, createTestToken } from '../../../src/utils/dolomite-utils';
import { expect } from 'chai';
import { expectThrow } from '../../utils/assertions';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';

const CHAINLINK_REGISTRY_ADDRESS = '0x75c0530885F385721fddA23C539AF3701d6183D4';
const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
describe('DolomitePriceOracleChainlink', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let token: CustomTestToken;
  let chainlinkRegistry: SignerWithAddress;

  let dolomitePriceOracleChainlink: TestDolomitePriceOracleChainlink;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    token = await createTestToken();
    chainlinkRegistry = await impersonate(CHAINLINK_REGISTRY_ADDRESS, true);

    dolomitePriceOracleChainlink = await createContractWithAbi<TestDolomitePriceOracleChainlink>(
      TestDolomitePriceOracleChainlink__factory.abi,
      TestDolomitePriceOracleChainlink__factory.bytecode,
      [core.dolomiteMargin.address, chainlinkRegistry.address],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should construct properly', async () => {
      expect(await dolomitePriceOracleChainlink.HEARTBEAT()).to.eq(12 * 3600);
      expect(await dolomitePriceOracleChainlink.UPPER_EDGE()).to.eq(10025);
      expect(await dolomitePriceOracleChainlink.LOWER_EDGE()).to.eq(9975);
      expect(await dolomitePriceOracleChainlink.CHAINLINK_REGISTRY()).to.eq(chainlinkRegistry.address);
    });
  });

  describe('#ownerSetHeartbeat', () => {
    it('should work', async () => {
      await dolomitePriceOracleChainlink.connect(core.governance).ownerSetHeartbeat(11 * 3600);
      expect(await dolomitePriceOracleChainlink.HEARTBEAT()).to.eq(11 * 3600);
    });
    it('should fail when not called by owner', async () => {
      await expectThrow(
        dolomitePriceOracleChainlink.connect(core.hhUser1).ownerSetHeartbeat(11 * 3600),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetUpperEdge', () => {
    it('should work', async () => {
      await dolomitePriceOracleChainlink.connect(core.governance).ownerSetUpperEdge(10030);
      expect(await dolomitePriceOracleChainlink.UPPER_EDGE()).to.eq(10030);
    });
    it('should fail when not called by owner', async () => {
      await expectThrow(
        dolomitePriceOracleChainlink.connect(core.hhUser1).ownerSetUpperEdge(10030),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
    it('should fail when upperEdge less than 10000', async () => {
      await expectThrow(
        dolomitePriceOracleChainlink.connect(core.governance).ownerSetUpperEdge(10000),
        'DolomitePriceOracleChainlink: Invalid upper edge',
      );
      await expectThrow(
        dolomitePriceOracleChainlink.connect(core.governance).ownerSetUpperEdge(9999),
        'DolomitePriceOracleChainlink: Invalid upper edge',
      );
    });
  });

  describe('#ownerSetLowerEdge', () => {
    it('should work', async () => {
      await dolomitePriceOracleChainlink.connect(core.governance).ownerSetLowerEdge(9980);
      expect(await dolomitePriceOracleChainlink.LOWER_EDGE()).to.eq(9980);
    });
    it('should fail when not called by owner', async () => {
      await expectThrow(
        dolomitePriceOracleChainlink.connect(core.hhUser1).ownerSetLowerEdge(10030),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
    it('should fail when lowerEdge more than 10000', async () => {
      await expectThrow(
        dolomitePriceOracleChainlink.connect(core.governance).ownerSetLowerEdge(10000),
        'DolomitePriceOracleChainlink: Invalid lower edge',
      );
      await expectThrow(
        dolomitePriceOracleChainlink.connect(core.governance).ownerSetLowerEdge(10020),
        'DolomitePriceOracleChainlink: Invalid lower edge',
      );
    });
  });

  describe('#ownerSetChainlinkRegistry', () => {
    it('should work', async () => {
      await dolomitePriceOracleChainlink.connect(core.governance).ownerSetChainlinkRegistry(OTHER_ADDRESS);
      expect(await dolomitePriceOracleChainlink.CHAINLINK_REGISTRY()).to.eq(OTHER_ADDRESS);
    });
    it('should fail when not called by owner', async () => {
      await expectThrow(
        dolomitePriceOracleChainlink.connect(core.hhUser1).ownerSetChainlinkRegistry(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
    it('should fail when zero address is used', async () => {
      await expectThrow(
        dolomitePriceOracleChainlink.connect(core.governance).ownerSetChainlinkRegistry(ZERO_ADDRESS),
        'DolomitePriceOracleChainlink: Invalid chainlink registry',
      );
    });
  });
});
