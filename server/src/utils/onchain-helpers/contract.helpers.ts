import "dotenv/config";
import {walletClient} from "./viem.init";
import escrowABI from "../abi/escrow.json";

const ESCROW_CONTRACT = process.env.ESCROW_CONTRACT as `0x${string}`;

export const writeResolve = async (gameId: `0x${string}`, winner: `0x${string}`): Promise<string | void> => {
    try {
        const tx = await walletClient.writeContract({
            address: ESCROW_CONTRACT,
            abi: escrowABI,
            functionName: "resolveGame",
            args: [gameId, winner]
        });

        await walletClient.waitForTransactionReceipt({ hash: tx });
        return tx;
    } catch (error) {
        console.error("Error writing resolve transaction:", error);
    }    
}
