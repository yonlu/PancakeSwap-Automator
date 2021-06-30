import * as dotenv from "dotenv";
import { Wallet } from "ethers";

import PancakeSwap from "./contracts/PancakeSwap";
import { setDefaultProvider, setWebSocketProvider } from "./services/provider";

dotenv.config();

const wallet = Wallet.fromMnemonic(process.env.MNEMONIC);
export const provider = setWebSocketProvider(process.env.WSS_PROVIDER);
export const account = wallet.connect(provider);

const pancakeSwap = new PancakeSwap();

pancakeSwap.buyToken("0x7ef95a0fee0dd31b22626fa2e10ee6a223f8a684", "0.001");
