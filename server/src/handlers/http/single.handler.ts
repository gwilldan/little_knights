import { Request, Response } from "express";
import { db } from "../../db/db.init";
import { gamesTable } from "../../db/schema";
import {gameInsert} from "../../utils/zod.config";
import { parseUnits } from "viem";

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

    console.log("Saving single game with data:", singleGameData);  

    await db.insert(gamesTable).values(singleGameData);

    console.log(`Saved single game with id ${roomId} for user ${uid}`);

    res.status(201).json({ ok: true, id: roomId });
  } catch (error: any) {
    if (error?.cause?.code === "23505") {
      console.warn("Game already exists with id:", req.body.roomId);
      res.status(409).json({ message: "Game already exists" });
      return;
    }

    console.error("Error saving single game:", error);
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message });
  }
};
