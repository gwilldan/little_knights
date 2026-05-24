// import { useState } from "react";
// import { Link, useNavigate } from "react-router";
// import { useAppSession } from "~/utils/app-session";

// export default function SingleRoute() {
//   const navigate = useNavigate();
//   const { createSingleGame, walletAddress } = useAppSession();
//   const [betAmount, setBetAmount] = useState("1");
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [errorMessage, setErrorMessage] = useState<string | null>(null);

//   async function onPlay() {
//     setIsSubmitting(true);
//     setErrorMessage(null);

//     try {
//       const { gameId } = await createSingleGame(betAmount);
//       navigate(`/single/play?gameId=${encodeURIComponent(gameId)}&bet=${encodeURIComponent(betAmount)}`);
//     } catch (error) {
//       setErrorMessage(error instanceof Error ? error.message : "Failed to create game.");
//     } finally {
//       setIsSubmitting(false);
//     }
//   }

//   return (
//     <main className="lk-menu-screen main_background">
//       <section className="lk-single-panel">
//         <h1 className="lk-single-title">Single Match</h1>
//         <p className="lk-single-sub">Review rules, set your stablecoin stake, and start when ready.</p>

//         <ul className="lk-rules-list">
//           <li>Capture the opponent king with standard chess rules.</li>
//           <li>You play as white and move first.</li>
//           <li>Stake is locked for this session flow only (placeholder for now).</li>
//         </ul>

//         <label className="lk-bet-label" htmlFor="betAmount">
//           Bet Amount (USDm)
//         </label>
//         <input
//           className="lk-bet-input"
//           id="betAmount"
//           min="0"
//           onChange={(event) => setBetAmount(event.target.value)}
//           step="0.1"
//           type="number"
//           value={betAmount}
//         />

//         <p className="lk-wallet-line">Wallet: {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Not connected"}</p>

//         {errorMessage ? <p className="lk-start-error">{errorMessage}</p> : null}

//         <div className="lk-single-actions">
//           <button className="lk-menu-button" disabled={isSubmitting} onClick={onPlay} type="button">
//             {isSubmitting ? "Creating..." : "Play"}
//           </button>
//           <Link className="lk-single-exit" to="/">
//             Exit
//           </Link>
//         </div>
//       </section>
//     </main>
//   );
// }
