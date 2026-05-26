// import {redis} from "../../services/redis.service"
import {walletClient} from "./viem.init"

let txNonce: number | null = null
let processing = false

export const getNonce = async () => {
    try {

        while(processing) await new Promise((res) => setTimeout(res, 10));

        processing = true;

        if(txNonce == null) {
            const getTxCount = await walletClient.getTransactionCount({
                address: walletClient.account.address,
                blockTag: "pending"
            })
            txNonce = getTxCount
        }
        return txNonce++
    } catch (error) {
        throw ({
            message: "failed to get Nonce",
            error
        })
    } finally {
        processing = false;
    }
}

