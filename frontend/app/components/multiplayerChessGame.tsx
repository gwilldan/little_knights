import { useEffect, useMemo, useState } from "react";
import NetworkChessGame from "~/components/networkChessGame";
import { useAppSession } from "~/utils/app-session";
import { signInUser } from "~/utils/auth";
import { getOrCreateUid } from "~/utils/user";

type MultiplayerChessGameProps = {
  roomId: string;
  title: string;
};

export default function MultiplayerChessGame({ roomId, title }: MultiplayerChessGameProps) {
  const { walletAddress } = useAppSession();
  const uid = useMemo(() => getOrCreateUid(walletAddress), [walletAddress]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function start() {
      const signedIn = await signInUser(uid);
      if (!active) return;

      if (!signedIn) {
        setReady(false);
        return;
      }

      setReady(true);
    }

    start();

    return () => {
      active = false;
    };
  }, [uid]);

  return <NetworkChessGame enabled={ready} mode="multiplayer" opponentLabel="Opponent" roomId={roomId} title={title} uid={uid} />;
}
