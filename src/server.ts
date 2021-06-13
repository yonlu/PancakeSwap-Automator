import * as dotenv from "dotenv";
import { Wallet } from "ethers";

import PancakeSwap from "./contracts/PancakeSwap";
import { setProvider } from "./services/provider";

dotenv.config();

const wallet = Wallet.fromMnemonic(process.env.MNEMONIC);
export const provider = setProvider(process.env.WSS_PROVIDER);
export const account = wallet.connect(provider);

const PancakeSwapDTO = {
  routerAddress: process.env.ROUTER,
  factoryAddress: process.env.FACTORY,
};

const pancakeSwap = new PancakeSwap(PancakeSwapDTO);
