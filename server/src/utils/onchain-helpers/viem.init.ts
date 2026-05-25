import {Chain, createWalletClient, http, PublicActions, publicActions, Transport, type WalletClient, Account} from "viem"
import { privateKeyToAccount } from "viem/accounts";
import {celoSepolia} from "viem/chains";

type ExtendedWalletClientType = WalletClient<Transport, Chain, Account> & PublicActions;

const privateKey = process.env.PKEY as `0x${string}`;
console.log("Initializing wallet client with private key:", privateKey);

export const walletClient = createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain: celoSepolia,
    transport: http()
}).extend(publicActions) as ExtendedWalletClientType;