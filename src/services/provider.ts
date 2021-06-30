import { providers, getDefaultProvider } from "ethers";

export const setWebSocketProvider = (
  providerAdress: string
): providers.WebSocketProvider => {
  return new providers.WebSocketProvider(providerAdress);
};

export const setDefaultProvider = (): providers.BaseProvider => {
  return getDefaultProvider("https://data-seed-prebsc-1-s1.binance.org:8545/");
};
