"use client";

import { useEffect, useRef, useState } from "react";
import type { GameComponentProps } from "@rarefriends/friendsdk/runtime";
import { formatGameAmount } from "@rarefriends/friendsdk/ui";
import { maximumPrize, type GameSnapshot } from "@rarefriends/friendsdk/game";
import { createFriendSoundKit, type FriendSoundCue, type FriendSoundKit } from "@rarefriends/friendsdk/sounds";
import { createFriendReader, spriteFrame, type GenerationSprites } from "@rarefriends/friendsdk/sprites";
import "./style.css";

const COINS = ["BTC", "ETH", "SOL", "HYPE", "SUI", "XPL"] as const;
type Coin = (typeof COINS)[number];
type Side = "long" | "short";
type Quote = { px: number; dir: -1 | 0 | 1 };
type Paper = { coin: Coin; side: Side; entry: number; outcomeId: number; print: string };

const SIZE_USD = 200;
const LEVERAGE = 3;
// Against-the-trader fill, aligned with game.json: Flat tape, Clean fill, Rare print.
// The sandbox cannot call Hyperliquid, so marks are generated here.
const SLIP_AGAINST = [0.004, 0, -0.0025] as const;
const SPECS: Record<Coin, { start: number; vol: number }> = {
  BTC: { start: 64210, vol: 0.0011 },
  ETH: { start: 3412, vol: 0.0014 },
  SOL: { start: 148.2, vol: 0.0018 },
  HYPE: { start: 41.8, vol: 0.0022 },
  SUI: { start: 1.842, vol: 0.0024 },
  XPL: { start: 0.1194, vol: 0.003 },
};

const rf = (value: bigint) => `${formatGameAmount(value, 18)} RF`;

function freshTape(): Record<Coin, Quote> {
  return Object.fromEntries(COINS.map(coin => [coin, { px: SPECS[coin].start, dir: 0 }])) as Record<Coin, Quote>;
}

function stepTape(prev: Record<Coin, Quote>): Record<Coin, Quote> {
  const buf = new Uint32Array(COINS.length);
  crypto.getRandomValues(buf);
  const next = { ...prev };
  for (let i = 0; i < COINS.length; i++) {
    const coin = COINS[i];
    const unit = buf[i] / 4294967296 * 2 - 1;
    const px = Math.max(SPECS[coin].start * 0.25, prev[coin].px * (1 + unit * SPECS[coin].vol));
    next[coin] = { px, dir: px > prev[coin].px ? 1 : px < prev[coin].px ? -1 : 0 };
  }
  return next;
}

function formatPx(px: number) {
  if (px >= 1000) return px.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (px >= 100) return px.toFixed(2);
  if (px >= 1) return px.toFixed(3);
  return px.toFixed(4);
}

function formatPct(value: number) {
  if (Math.abs(value) < 0.00005) return "0.00%";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value * 100).toFixed(2)}%`;
}

function formatUsd(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function moveOf(side: Side, entry: number, mark: number) {
  if (entry <= 0 || mark <= 0) return 0;
  return side === "long" ? mark / entry - 1 : entry / mark - 1;
}

function fillPrice(mark: number, side: Side, outcomeId: number) {
  const against = SLIP_AGAINST[outcomeId - 1] ?? SLIP_AGAINST[0];
  const signed = side === "long" ? against : -against;
  return mark * (1 + signed);
}

function paintFriend(canvas: HTMLCanvasElement, sprites: GenerationSprites, frame: number) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const rows = spriteFrame(sprites, "down", false, frame).frame.rows;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;
  const pixels = rows.flatMap((row, y) => [...row].flatMap((pixel, x) => pixel === "#" ? [[x, y] as const] : []));
  const origin = 8;
  context.fillStyle = "#fff";
  for (const [x, y] of pixels) context.fillRect(origin + x * 5 - 5, origin + y * 5 - 5, 15, 15);
  context.fillStyle = "#000";
  for (const [x, y] of pixels) context.fillRect(origin + x * 5, origin + y * 5, 5, 5);
}

/** Canonical Generations pixels for this Friend. No recolor, crop, or mirror. */
function FriendSeat({ friendId, paused, reducedMotion }: { friendId: bigint; paused: boolean; reducedMotion: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const sprites = useRef<GenerationSprites | null>(null);
  const live = useRef({ paused, reducedMotion });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [family, setFamily] = useState("");
  const [attempt, setAttempt] = useState(0);
  live.current = { paused, reducedMotion };

  useEffect(() => {
    let stop = false;
    setStatus("loading");
    setFamily("");
    sprites.current = null;
    void createFriendReader().read(friendId).then(value => {
      if (stop) return;
      sprites.current = value;
      if (canvas.current) paintFriend(canvas.current, value, 0);
      setFamily(value.familyName);
      setStatus("ready");
    }).catch(() => { if (!stop) setStatus("error"); });
    return () => { stop = true; };
  }, [friendId, attempt]);

  useEffect(() => {
    if (status !== "ready") return;
    const node = canvas.current;
    const art = sprites.current;
    if (!node || !art) return;
    let handle = 0;
    const draw = (now: number) => {
      const still = live.current.paused || live.current.reducedMotion || document.hidden;
      paintFriend(node, art, still ? 0 : Math.floor(now / 110) % 8);
      handle = requestAnimationFrame(draw);
    };
    handle = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(handle);
  }, [status, friendId]);

  return <figure className="seat">
    <canvas ref={canvas} width={96} height={96} data-friend={status === "ready" ? friendId.toString() : undefined}
      aria-label={family ? `Your Rare Friend, ${family}, original Generations artwork` : "Your Rare Friend, original Generations artwork"} />
    <figcaption>
      {status === "loading" ? "Bringing your Friend to the desk…" : status === "error" ? "Friend artwork did not load." : `Your Friend · ${family}`}
      {status === "error" && <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry artwork</button>}
    </figcaption>
  </figure>;
}

/** Simulated desk. Friend identity comes from the SDK. No private key and no live order. */
export default function WalletADesk({ friendId, client, paused }: GameComponentProps) {
  const definition = client.definition;
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tape, setTape] = useState(freshTape);
  const [selected, setSelected] = useState<Coin>("BTC");
  const [paper, setPaper] = useState<Paper | null>(null);
  const [realized, setRealized] = useState(0);
  const [lastClose, setLastClose] = useState("");
  const [sheet, setSheet] = useState<"prints" | null>(null);
  const [muted, setMuted] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [attention, setAttention] = useState(false);
  const sound = useRef<FriendSoundKit | null>(null);
  const locked = useRef(false);
  const epoch = useRef(0);
  const motionOverride = useRef<boolean | null>(null);
  const api = useRef({
    buyChip: () => {},
    printTicket: (_side: Side) => {},
    closeTicket: () => {},
    paused: false,
    busy: false,
    sheet: null as "prints" | null,
  });

  useEffect(() => {
    const kit = createFriendSoundKit({ muted: true });
    sound.current = kit;
    return () => { kit.dispose(); if (sound.current === kit) sound.current = null; };
  }, []);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { if (motionOverride.current === null) setReducedMotion(preference.matches); };
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let live = true;
    const version = ++epoch.current;
    locked.current = false;
    setSnapshot(null);
    setPaper(null);
    setRealized(0);
    setLastClose("");
    setError("");
    setMessage("");
    setBusy(false);
    setSheet(null);
    setAttention(false);
    void client.read().then(value => {
      if (live && version === epoch.current) setSnapshot(value);
    }).catch(cause => {
      if (live && version === epoch.current) setError(cause instanceof Error ? cause.message : "Could not open the desk.");
    });
    return () => { live = false; epoch.current += 1; locked.current = false; };
  }, [client, friendId, attempt]);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => setTape(stepTape), 1000);
    return () => window.clearInterval(timer);
  }, [paused]);

  function playCue(cue: FriendSoundCue) {
    sound.current?.play(cue);
  }

  async function buyChip() {
    if (locked.current || paused || !snapshot) return;
    const maxPrize = maximumPrize(definition);
    if (snapshot.rfBalance < definition.price) {
      setError("Not enough simulated RF for a chip.");
      setMessage("");
      return;
    }
    if (snapshot.freeStake < maxPrize || snapshot.freeStake + definition.price < maxPrize) {
      setError("Redeem a print before buying another chip. The preview has to keep the top prize backed.");
      setMessage("");
      return;
    }
    const version = epoch.current;
    locked.current = true;
    setBusy(true);
    setError("");
    setMessage("Confirm the chip on the frame. Simulated RF only.");
    try {
      void sound.current?.unlock();
      await client.buy(1n);
      const value = await client.read();
      if (version !== epoch.current) return;
      setSnapshot(value);
      setAttention(false);
      setMessage("Desk chip added. Pick a name, then long or short.");
      playCue("purchase");
    } catch (cause) {
      if (version === epoch.current) setError(cause instanceof Error ? cause.message : "Could not buy a chip.");
    } finally {
      if (version === epoch.current) { locked.current = false; setBusy(false); }
    }
  }

  async function printTicket(side: Side) {
    if (locked.current || paused || paper || sheet || !snapshot) return;
    const pending = snapshot.plays.find(play => play.outcomeId === null);
    if (!pending && snapshot.consumables < 1n) {
      setError("Buy a desk chip first. One chip prints one ticket.");
      setMessage("");
      setAttention(true);
      return;
    }
    const coin = selected;
    const mark = tape[coin].px;
    const version = epoch.current;
    locked.current = true;
    setBusy(true);
    setError("");
    setMessage(pending
      ? "Finish the stamp on the frame. This does not spend a second chip."
      : "Confirm the chip on the frame. Preview only — nothing is signed.");
    try {
      void sound.current?.unlock();
      playCue("action-start");
      const play = pending ?? (await client.play(1n))[0];
      if (version !== epoch.current) return;
      const settled = await client.settle(play.id);
      if (settled.outcomeId == null) throw new Error("The print did not settle.");
      const value = await client.read();
      if (version !== epoch.current) return;
      const outcome = definition.outcomes[settled.outcomeId - 1];
      setSnapshot(value);
      setPaper({ coin, side, entry: fillPrice(mark, side, settled.outcomeId), outcomeId: settled.outcomeId, print: outcome.name });
      setLastClose("");
      setMessage(`${outcome.name}. Simulated ${side} ${coin}. Not a live order.`);
      playCue(settled.outcomeId === 3 ? "reveal-rare" : settled.outcomeId === 1 ? "impact" : "reveal-common");
    } catch (cause) {
      if (version !== epoch.current) return;
      setError(cause instanceof Error ? cause.message : "Could not print a ticket.");
      try {
        const value = await client.read();
        if (version === epoch.current) setSnapshot(value);
      } catch { /* The next action reads again. */ }
    } finally {
      if (version === epoch.current) { locked.current = false; setBusy(false); }
    }
  }

  function closeTicket() {
    if (!paper || paused || busy) return;
    const mark = tape[paper.coin].px;
    const pnl = moveOf(paper.side, paper.entry, mark) * SIZE_USD;
    setRealized(value => value + pnl);
    setLastClose(`Closed ${paper.side} ${paper.coin} · ${formatUsd(pnl)}. The print stays in your stack.`);
    setMessage("");
    setError("");
    setPaper(null);
    playCue(pnl >= 0 ? "reward" : "impact");
  }

  async function redeem(outcomeId: number) {
    if (locked.current || paused || !snapshot) return;
    const version = epoch.current;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      void sound.current?.unlock();
      await client.redeem(outcomeId, 1n);
      const value = await client.read();
      if (version !== epoch.current) return;
      setSnapshot(value);
      setMessage(`Redeemed ${definition.outcomes[outcomeId - 1].name}. Simulated RF returned to this Friend.`);
      playCue("reward");
    } catch (cause) {
      if (version === epoch.current) setError(cause instanceof Error ? cause.message : "Could not redeem.");
    } finally {
      if (version === epoch.current) { locked.current = false; setBusy(false); }
    }
  }

  api.current = { buyChip: () => void buyChip(), printTicket: side => void printTicket(side), closeTicket, paused, busy, sheet };

  useEffect(() => {
    const row = document.querySelector<HTMLElement>(`[data-coin="${selected}"]`);
    row?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selected]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const key = event.key.toLowerCase();
      if (key === "escape") { setSheet(null); return; }
      const now = api.current;
      if (now.sheet || now.paused || now.busy) return;
      if (key === "arrowdown" || key === "arrowup") {
        event.preventDefault();
        setSelected(current => {
          const index = COINS.indexOf(current);
          const step = key === "arrowdown" ? 1 : -1;
          return COINS[(index + step + COINS.length) % COINS.length];
        });
        return;
      }
      const number = Number(event.key);
      if (number >= 1 && number <= COINS.length) { setSelected(COINS[number - 1]); return; }
      if (key === "l") { event.preventDefault(); now.printTicket("long"); }
      if (key === "s") { event.preventDefault(); now.printTicket("short"); }
      if (key === "c") { event.preventDefault(); now.closeTicket(); }
      if (key === "b") { event.preventDefault(); now.buyChip(); }
      if (key === "p") { event.preventDefault(); setSheet("prints"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!snapshot) {
    return <section className="desk desk-boot" role={error ? "alert" : "status"}>
      <p>{error || "Opening the desk…"}</p>
      {error && <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry</button>}
    </section>;
  }
  if (snapshot.friendId !== friendId) return <section className="desk desk-boot" role="alert"><p>This desk does not match the selected Friend.</p></section>;

  const mark = paper ? tape[paper.coin].px : 0;
  const openMove = paper ? moveOf(paper.side, paper.entry, mark) : 0;
  const openPnl = openMove * SIZE_USD;
  const book = realized + openPnl;
  const maxPrize = maximumPrize(definition);
  const canBuy = snapshot.rfBalance >= definition.price && snapshot.freeStake >= maxPrize && snapshot.freeStake + definition.price >= maxPrize;
  const pending = snapshot.plays.some(play => play.outcomeId === null);
  const chips = snapshot.consumables;
  const note = error || message || lastClose || (paused ? "Paused." : "Simulated marks. No live order leaves this desk.");

  return <section className={`desk${reducedMotion ? " desk-still" : ""}`} aria-label={definition.name} aria-busy={busy} data-desk="ready">
    <header className="top">
      <div className="brand">
        <small>Wallet A · simulated</small>
        <h1>Desk</h1>
      </div>
      <dl className="stats">
        <div><dt>Chips</dt><dd data-chips={chips.toString()}>{chips.toString()}</dd></div>
        <div><dt>RF</dt><dd>{rf(snapshot.rfBalance).replace(" RF", "")}</dd></div>
        <div><dt>Book</dt><dd data-book={book.toFixed(2)} data-sign={book > 0 ? "up" : book < 0 ? "down" : "flat"}>{formatUsd(book)}</dd></div>
      </dl>
      <button type="button" className="ghost sound" aria-label={muted ? "Sound off" : "Sound on"} aria-pressed={!muted} onClick={() => {
        const next = !muted;
        setMuted(next);
        sound.current?.setMuted(next);
        if (!next) void sound.current?.unlock();
      }}>Sound</button>
    </header>

    <div className="desk-main" inert={sheet ? true : undefined}>
      <div className="tape">
        <div className="tape-head"><span>Tape</span><span>Simulated · 1s</span></div>
        <div role="radiogroup" aria-label="Names">
          {COINS.map(coin => {
            const quote = tape[coin];
            const change = quote.px / SPECS[coin].start - 1;
            const on = coin === selected;
            return <button type="button" role="radio" key={coin} className="coin" data-coin={coin} data-px={quote.px} aria-checked={on} aria-label={coin}
              onClick={() => { if (!busy && !paused) { setSelected(coin); playCue("select"); } }}>
              <span className="sym">{coin}</span>
              <span className="px">{formatPx(quote.px)}</span>
              <span className="chg" data-dir={quote.dir === 1 ? "up" : quote.dir === -1 ? "down" : change >= 0 ? "up" : "down"}>{formatPct(change)}</span>
            </button>;
          })}
        </div>
      </div>

      <aside className="ticket-pane">
        <FriendSeat friendId={friendId} paused={paused || Boolean(sheet)} reducedMotion={reducedMotion} />
        {paper ? <article className="ticket" data-open="true" data-print={paper.print}>
          <p className="ticket-kicker">Open ticket · ${SIZE_USD} · {LEVERAGE}×</p>
          <h2>{paper.side} {paper.coin}</h2>
          <p className={`stamp stamp-${paper.outcomeId}`} data-stamp={paper.print}>{paper.print}</p>
          <dl className="ticket-nums">
            <div><dt>Entry</dt><dd>{formatPx(paper.entry)}</dd></div>
            <div><dt>Mark</dt><dd>{formatPx(mark)}</dd></div>
            <div><dt>Move</dt><dd data-sign={openMove > 0 ? "up" : openMove < 0 ? "down" : "flat"}>{formatPct(openMove)}</dd></div>
            <div><dt>ROE</dt><dd data-sign={openMove > 0 ? "up" : openMove < 0 ? "down" : "flat"}>{formatPct(openMove * LEVERAGE)}</dd></div>
            <div><dt>PnL</dt><dd data-sign={openPnl > 0 ? "up" : openPnl < 0 ? "down" : "flat"}>{formatUsd(openPnl)}</dd></div>
          </dl>
          <p className="fine">Fill is stamped from the print. Marks keep walking until you close.</p>
        </article> : <article className="ticket ticket-empty" data-open="false">
          <p className="ticket-kicker">{pending ? "Stamp waiting" : "No open ticket"}</p>
          <h2>{pending ? "Finish the print" : `Print ${selected}`}</h2>
          <p className="blurb">One chip prints one ticket. The stamp sets the fill.</p>
          <ol>
            <li>Buy one desk chip for {rf(definition.price)}.</li>
            <li>Pick a name. Long or short spends the chip and stamps the fill.</li>
            <li>Close when you want. PnL stays on this desk. Redeem the print for simulated RF.</li>
          </ol>
          <ul className="odds">
            {definition.outcomes.map((item, index) => <li key={item.name}>
              <strong>{item.name}</strong>
              <span>{item.chanceBps / 100}% · {rf(item.reward)} · {SLIP_AGAINST[index] > 0 ? `${(SLIP_AGAINST[index] * 100).toFixed(2)}% against` : SLIP_AGAINST[index] < 0 ? `${(-SLIP_AGAINST[index] * 100).toFixed(2)}% for you` : "fill at the mark"}</span>
            </li>)}
          </ul>
        </article>}
      </aside>
    </div>

    <footer>
      <div className="actions">
        <button type="button" className="long" disabled={paused || busy || Boolean(paper)} onClick={() => void printTicket("long")}>Long</button>
        <button type="button" className="short" disabled={paused || busy || Boolean(paper)} onClick={() => void printTicket("short")}>Short</button>
        <button type="button" className="ghost close" disabled={paused || busy || !paper} onClick={closeTicket}>Close ticket</button>
        <button type="button" className={`buy${attention ? " attention" : ""}`} disabled={!canBuy || busy || paused} onClick={() => void buyChip()}>Buy chip · {rf(definition.price)}</button>
        <button type="button" className="ghost prints" disabled={busy || paused} onClick={() => { setSheet("prints"); setError(""); }}>Prints</button>
      </div>
      <p className="status" role={sheet ? undefined : error ? "alert" : "status"} data-kind={error ? "error" : "ok"} hidden={sheet ? true : undefined}>{note}</p>
      <p className="hint">↑↓ or 1–6 select · L long · S short · C close · B chip · P prints</p>
    </footer>

    {sheet === "prints" && <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="prints-title">
      <div className="sheet-card">
        <div className="sheet-bar">
          <h2 id="prints-title">Prints</h2>
          <button type="button" onClick={() => setSheet(null)}>Close</button>
        </div>
        <p className="fine">Kept prints redeem for the RF on the chip. Reloading clears this preview. Nothing here is a live position.</p>
        {pending && <p className="pending">One print is waiting for a stamp. Close this and press long or short. It will not spend another chip.</p>}
        <ul className="stack">
          {definition.outcomes.map((item, index) => <li key={item.name}>
            <span><strong>{item.name}</strong><small>{item.chanceBps / 100}% · {rf(item.reward)} · {snapshot.inventory[index].toString()} kept</small></span>
            <button type="button" disabled={busy || paused || snapshot.inventory[index] === 0n} onClick={() => void redeem(index + 1)}>Redeem {item.name}</button>
          </li>)}
        </ul>
        <label className="motion"><input type="checkbox" checked={reducedMotion} onChange={event => { motionOverride.current = event.target.checked; setReducedMotion(event.target.checked); }} /> Reduce motion</label>
        <p className="status" role={error ? "alert" : "status"}>{error || message || "Simulated RF."}</p>
      </div>
    </div>}
  </section>;
}
