import {
  MagicGLPPriceOracle,
  MagicGLPPriceOracle__factory,
  MagicGLPUnwrapperTraderV1,
  MagicGLPUnwrapperTraderV1__factory,
  MagicGLPUnwrapperTraderV2,
  MagicGLPUnwrapperTraderV2__factory,
  MagicGLPWrapperTraderV1,
  MagicGLPWrapperTraderV1__factory,
  MagicGLPWrapperTraderV2,
  MagicGLPWrapperTraderV2__factory,
} from '../../../src/types';
import {
  getMagicGLPPriceOracleConstructorParams,
  getMagicGLPUnwrapperTraderV1ConstructorParams,
  getMagicGLPUnwrapperTraderV2ConstructorParams,
  getMagicGLPWrapperTraderV1ConstructorParams,
  getMagicGLPWrapperTraderV2ConstructorParams,
} from '../../../src/utils/constructors/abracadabra';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { CoreProtocol } from '../setup';

export async function createMagicGLPPriceOracle(core: CoreProtocol): Promise<MagicGLPPriceOracle> {
  return createContractWithAbi(
    MagicGLPPriceOracle__factory.abi,
    MagicGLPPriceOracle__factory.bytecode,
    getMagicGLPPriceOracleConstructorParams(core),
  );
}

export async function createMagicGLPUnwrapperTraderV1(core: CoreProtocol): Promise<MagicGLPUnwrapperTraderV1> {
  return createContractWithAbi(
    MagicGLPUnwrapperTraderV1__factory.abi,
    MagicGLPUnwrapperTraderV1__factory.bytecode,
    getMagicGLPUnwrapperTraderV1ConstructorParams(core),
  );
}

export async function createMagicGLPUnwrapperTraderV2(core: CoreProtocol): Promise<MagicGLPUnwrapperTraderV2> {
  return createContractWithAbi(
    MagicGLPUnwrapperTraderV2__factory.abi,
    MagicGLPUnwrapperTraderV2__factory.bytecode,
    getMagicGLPUnwrapperTraderV2ConstructorParams(core),
  );
}

export async function createMagicGLPWrapperTraderV1(core: CoreProtocol): Promise<MagicGLPWrapperTraderV1> {
  return createContractWithAbi(
    MagicGLPWrapperTraderV1__factory.abi,
    MagicGLPWrapperTraderV1__factory.bytecode,
    getMagicGLPWrapperTraderV1ConstructorParams(core),
  );
}

export async function createMagicGLPWrapperTraderV2(core: CoreProtocol): Promise<MagicGLPWrapperTraderV2> {
  return createContractWithAbi(
    MagicGLPWrapperTraderV2__factory.abi,
    MagicGLPWrapperTraderV2__factory.bytecode,
    getMagicGLPWrapperTraderV2ConstructorParams(core),
  );
}
