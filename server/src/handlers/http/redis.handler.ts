import {Request, Response} from "express"
import {getNonce} from "../../utils/onchain-helpers/nonceCounter"

export const getTxNonce = async (req: Request, res: Response) => {
    const data = await getNonce()

    if(!data) {
        res.status(401).json("no data found!")
    }
    res.json(data);
};
