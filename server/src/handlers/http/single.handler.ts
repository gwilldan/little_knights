import { Request, Response } from "express";
import { db } from "../../db/db.init";
import { gamesTable } from "../../db/schema";
import {gameInsert} from "../../utils/zod.config";
import { parseUnits } from "viem";
import { logAppEvent, shortId } from "../../utils/appLogger";

export const saveSingleGame = async (req: Request, res: Response) => {
  try {
    const { roomId, uid, amount, txHash } = req.body as {
      roomId?: string;
      uid?: string;
      amount?: string;
      txHash?: string;
    };

    if(!amount) {
      res.status(400).json({ message: "Bet amount is required" });
      return;
    }

    const singleGameData = gameInsert.parse({
      id: roomId,
      user1: uid,
      is_multiplayer: false,
      is_timed: true,
      start_time: new Date(),
      bet_amount: parseUnits(amount, 6),
      game_status: "active",
      init_tx: txHash,
      start_tx: txHash,
    })

    await db.insert(gamesTable).values(singleGameData);

    logAppEvent("game_start", {
      roomId: shortId(roomId),
      userId: shortId(uid),
      txHash: shortId(txHash),
      mode: "single"
    });

    res.status(201).json({ ok: true, id: roomId });
  } catch (error: any) {
    if (error?.cause?.code === "23505") {
      res.status(409).json({ message: "Game already exists" });
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message });
  }
};
