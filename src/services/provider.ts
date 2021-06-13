import { providers } from "ethers";

export const setProvider = (
  providerAdress: string
): providers.WebSocketProvider => {
  return new providers.WebSocketProvider(providerAdress);
};
