import { Request, Response } from "express";
import { db } from "../../db/db.init";
import { gamesTable } from "../../db/schema";

export const saveSingleGame = async (req: Request, res: Response) => {
  try {
    const { roomId, uid, walletAddress } = req.body as {
      roomId?: string;
      uid?: string;
      walletAddress?: string;
    };

    if (!roomId?.trim() || !uid?.trim()) {
      res.status(400).json({ message: "roomId and uid are required" });
      return;
    }

    if (!req.userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (walletAddress && walletAddress.trim() !== req.userId) {
      res.status(403).json({ message: "Invalid session user." });
      return;
    }

    await db.insert(gamesTable).values({
      id: roomId.trim(),
      user1: uid.trim(),
      user2: null,
      is_multiplayer: false,
      is_timed: true,
      start_time: new Date(),
      stop_time: null,
    });

    console.log(`Saved single game with id ${roomId} for user ${uid}`);

    res.status(201).json({ ok: true, id: roomId.trim() });
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
