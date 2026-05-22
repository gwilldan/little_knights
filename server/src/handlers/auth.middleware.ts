import { Request, Response, NextFunction } from "express";
import { getUserIdFromCookieHeader } from "../utils/auth";

declare global {
    namespace Express {
        interface Request {
            userId?: string;
        }
    }
}

export const auth = (req: Request, res: Response, next: NextFunction): void => {
    const userId = getUserIdFromCookieHeader(req.headers.cookie);
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }

    req.userId = userId;
    next();
};
