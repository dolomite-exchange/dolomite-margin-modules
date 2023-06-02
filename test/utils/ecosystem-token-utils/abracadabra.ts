import {
  MagicGLPPriceOracle,
  MagicGLPPriceOracle__factory,
  MagicGLPUnwrapperTraderV1,
  MagicGLPUnwrapperTraderV1__factory,
  MagicGLPWrapperTraderV1,
  MagicGLPWrapperTraderV1__factory,
} from '../../../src/types';
import {
  getMagicGLPPriceOracleConstructorParams,
  getMagicGLPUnwrapperTraderV1ConstructorParams,
  getMagicGLPWrapperTraderV1ConstructorParams,
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

export async function createMagicGLPWrapperTraderV1(core: CoreProtocol): Promise<MagicGLPWrapperTraderV1> {
  return createContractWithAbi(
    MagicGLPWrapperTraderV1__factory.abi,
    MagicGLPWrapperTraderV1__factory.bytecode,
    getMagicGLPWrapperTraderV1ConstructorParams(core),
  );
}
