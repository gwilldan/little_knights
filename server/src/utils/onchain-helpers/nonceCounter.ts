import {walletClient} from "./viem.init"

let processing = false

export const getNonce = async () => {
    try {

        while(processing) await new Promise((res) => setTimeout(res, 10));

        processing = true;

        const txCount = await walletClient.getTransactionCount({
            address: walletClient.account.address,
            blockTag: "pending"
        })

        return txCount
    } catch (error) {
        throw ({
            message: "failed to get Nonce",
            error
        })
    } finally {
        processing = false;
    }
}

