import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import NetworkChessGame from "~/components/networkChessGame";
import { useAppSession } from "~/utils/app-session";
import { signInUser } from "~/utils/auth";
import { getOrCreateUid } from "~/utils/user";

type MultiplayerChessGameProps = {
  roomId: string;
  title: string;
};

export default function MultiplayerChessGame({
  roomId,
  title,
}: MultiplayerChessGameProps) {
  const { walletAddress } = useAppSession();
  const uid = useMemo(() => getOrCreateUid(walletAddress), [walletAddress]);
  const [ready, setReady] = useState(false);
  const [startLoading, setStartLoading] = useState<boolean>(false);

  useEffect(() => {
    let active = true;

    async function start() {
      if (!walletAddress) {
        setReady(false);
        return;
      }

      const signedIn = await signInUser({
        id: walletAddress,
        name: `Player-${walletAddress.slice(2, 8)}`,
        balance: "0",
      });

      if (!active) return;

      if (!signedIn) {
        setReady(false);
        return;
      }

      setReady(true);
    }

    void start();

    return () => {
      active = false;
    };
  }, [uid, walletAddress]);

  return (
    <>
      <NetworkChessGame
        enabled={ready}
        mode="multiplayer"
        opponentLabel="Opponent"
        roomId={roomId}
        title={title}
        uid={uid}
        setStartLoading={setStartLoading}
      />

      {/* we're just using this start loader for now coz dev is lazy, we'd use it's real state later */}
      {!startLoading && (
        <div className="lk-modal-backdrop lk-modal-backdrop-fixed">
          <div className="lk-modal lk-modal-dark lk-start-modal">
            <Link
              to={"/"}
              aria-label="Exit to home"
              className="lk-modal-close"
              type="button"
            >
              ×
            </Link>
            <p className=" my-4">TWO Player game coming sooon!</p>
            <Link
              to={"/"}
              className="lk-action-btn lk-action-primary lk-start-play"
              type="button"
            >
              Go Home
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
