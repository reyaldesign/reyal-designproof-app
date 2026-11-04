'use client';

// Pieces of the client review page that only show things: the round indicator, progress, page list, dialogs and success screens.
// The state they show lives in ReviewClient.

export type PageState = { id: string; name: string; comments: number; good: boolean; thumb?: string };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Round 1 of 2" with one segment per included round. The last round turns amber. */
export function RoundBar({ round, included, sent }: { round: number; included: number; sent: boolean }) {
  const final = !sent && included > 1 && round >= included;
  const shown = Math.min(round, included);
  const label = sent ? `Round ${shown} of ${included} sent` : final ? `Round ${shown} of ${included}, final round` : `Round ${shown} of ${included}`;
  return (
    <span className={`fr-round ${final ? 'final' : ''}`} title={label}>
      <span className="lbl">{label}</span>
      <span className="segs" aria-hidden>{Array.from({ length: Math.min(included, 6) }, (_, k) => <i key={k} className={k < shown ? 'on' : ''} />)}</span>
    </span>
  );
}

/** How many pages are done: one segment per page, blue when it has comments, green when marked Looks good. */
export function ProgressCard({ pages }: { pages: PageState[] }) {
  const withC = pages.filter((p) => p.comments > 0).length;
  const good = pages.filter((p) => p.comments === 0 && p.good).length;
  return (
    <div className="fr-prog" role="status">
      <b>{withC + good} of {pages.length} pages done</b>
      <span className="segs" aria-hidden>{pages.map((p) => <i key={p.id} className={p.comments ? 'c' : p.good ? 'g' : ''} />)}</span>
      <span className="sub"><span><i className="dot c" />{withC} with comments</span><span><i className="dot g" />{good} marked Looks good</span></span>
    </div>
  );
}

export function PagesList({ pages, currentId, onGo }: { pages: PageState[]; currentId: string | null; onGo: (id: string) => void }) {
  return (
    <div className="fr-pages" role="list">
      {pages.map((p) => (
        <button key={p.id} role="listitem" className={`fr-prow ${p.id === currentId ? 'on' : ''}`} onClick={() => onGo(p.id)}>
          {p.thumb && <img className="th" src={`/files/${p.thumb}?w=320`} alt="" loading="lazy" />}
          <span className="nm">{p.name}</span>
          {p.comments > 0 ? <span className="chip c">{plural(p.comments, 'comment')}</span> : p.good ? <span className="chip g">✓ Looks good</span> : <span className="chip">Not started</span>}
        </button>
      ))}
    </div>
  );
}

type Shell = { onClose?: () => void; children: React.ReactNode; labelledBy: string };
const Shell = ({ onClose, children, labelledBy }: Shell) => (
  <div className="rv-overlay fr-dlg" role="dialog" aria-modal="true" aria-labelledby={labelledBy} onKeyDown={(e) => { if (e.key === 'Escape') onClose?.(); }}>
    <div className="rv-modal">{children}</div>
  </div>
);

/** Send a round: how many comments, how many rounds remain, an optional note for the whole site, and the person's name. */
export function SendDialog(p: {
  round: number; included: number; comments: number; pages: number; whole: string; setWhole: (v: string) => void;
  name: string; setName: (v: string) => void; busy: boolean; onCancel: () => void; onSend: () => void; wholeTooShort: boolean;
}) {
  const left = p.included - p.round;
  const count = p.comments + (p.whole.trim() ? 1 : 0);
  return (
    <Shell labelledBy="fr-send-h" onClose={p.busy ? undefined : p.onCancel}>
      <h2 id="fr-send-h">Send round {p.round} of {p.included}?</h2>
      <p>You&apos;re sending <b>{plural(p.comments, 'comment')}</b>{p.pages ? <> on <b>{plural(p.pages, 'page')}</b></> : null}. {left > 0 ? `You'll have ${left === 1 ? 'one more round' : `${left} more rounds`} after this.` : 'This is your last included round.'}</p>
      <label className="fr-lbl" htmlFor="fr-whole">Anything for the whole site? <span>(optional)</span></label>
      <textarea id="fr-whole" className="rv-field fr-area" rows={3} value={p.whole} onChange={(e) => p.setWhole(e.target.value)} placeholder="For example: a change that applies to every page" />
      {p.wholeTooShort && <p className="rv-err">Add a few more words to that note, or clear it.</p>}
      <input className="rv-field" value={p.name} onChange={(e) => p.setName(e.target.value)} placeholder="Your name" autoComplete="name" aria-label="Your name" />
      <div className="rv-actions">
        <button className="rv-ghost" onClick={p.onCancel} disabled={p.busy}>Cancel</button>
        <button className="rv-primary" onClick={p.onSend} disabled={p.busy || !p.name.trim() || p.wholeTooShort}>{p.busy ? 'Sending…' : `Send ${plural(count, 'comment')}`}</button>
      </div>
    </Shell>
  );
}

/** Ask, do not block: some pages have no comments and were not marked Looks good. */
export function GuardDialog(p: { open: string[]; last: boolean; onKeep: () => void; onSendAnyway: () => void }) {
  return (
    <Shell labelledBy="fr-guard-h" onClose={p.onKeep}>
      <h2 id="fr-guard-h">{plural(p.open.length, 'page')} {p.open.length === 1 ? 'has' : 'have'} no comments or approval</h2>
      <p>If {p.open.length === 1 ? 'that page is' : 'those pages are'} fine, tap Looks good on {p.open.length === 1 ? 'it' : 'each one'}. {p.last ? 'Or send now.' : 'Or send now and add the rest in your next round.'}</p>
      <div className="fr-open">
        <small>Still open</small>
        <ul>{p.open.slice(0, 8).map((n, k) => <li key={k}>{n}</li>)}{p.open.length > 8 && <li>and {p.open.length - 8} more</li>}</ul>
      </div>
      <div className="rv-actions">
        <button className="rv-ghost" onClick={p.onKeep}>Keep reviewing</button>
        <button className="rv-primary" onClick={p.onSendAnyway}>Send anyway</button>
      </div>
    </Shell>
  );
}

/** Shown the first time the final round is opened. */
export function FinalRoundDialog(p: { used: number; included: number; round: number; onStart: () => void }) {
  return (
    <Shell labelledBy="fr-final-h" onClose={p.onStart}>
      <span className="fr-eyebrow"><span className="segs" aria-hidden>{Array.from({ length: Math.min(p.included, 6) }, (_, k) => <i key={k} />)}</span>Round {p.round} of {p.included}</span>
      <h2 id="fr-final-h">This is your final round</h2>
      <p>You&apos;ve used {p.used} of {p.included} revision rounds. Check every page before you send, so nothing is missed.</p>
      <div className="rv-actions center"><button className="rv-primary" autoFocus onClick={p.onStart}>Start final round</button></div>
    </Shell>
  );
}

/** Approving is final, so it asks first. It keeps the name and the agreement the approval has always recorded. */
export function ApproveDialog(p: { noun: string; name: string; setName: (v: string) => void; agree: boolean; setAgree: (v: boolean) => void; busy: boolean; err: string; onCancel: () => void; onApprove: () => void }) {
  return (
    <Shell labelledBy="fr-app-h" onClose={p.busy ? undefined : p.onCancel}>
      <h2 id="fr-app-h">Approve this {p.noun}?</h2>
      <p>You&apos;re approving this {p.noun} as final. <b>No more revisions can be made after approval.</b> Later changes become a new job.</p>
      <input className="rv-field" value={p.name} onChange={(e) => p.setName(e.target.value)} placeholder="Your full name" autoComplete="name" aria-label="Your full name" />
      <label className="rv-check">
        <input type="checkbox" checked={p.agree} onChange={(e) => p.setAgree(e.target.checked)} />
        <i>{p.agree ? '✓' : ''}</i>
        I&apos;ve reviewed this {p.noun} and agree to these terms.
      </label>
      {p.err && <p className="rv-err">{p.err}</p>}
      <div className="rv-actions">
        <button className="rv-ghost" onClick={p.onCancel} disabled={p.busy}>Not yet</button>
        <button className="rv-go" disabled={p.busy || !p.agree || p.name.trim().length < 2} onClick={p.onApprove}>{p.busy ? 'Approving…' : `Approve ${p.noun}`}</button>
      </div>
    </Shell>
  );
}

/** Full-screen confirmation after a round is sent or the website is approved. */
export function SuccessScreen(p: { noun: string; kind: 'sent' | 'approved'; round: number; included: number; comments: number; pages: number; date: string; onClose: () => void }) {
  const left = p.included - p.round;
  const used = Math.min(p.round, p.included);
  return (
    <div className="rv-overlay fr-success" role="dialog" aria-modal="true" aria-labelledby="fr-ok-h" onKeyDown={(e) => { if (e.key === 'Escape') p.onClose(); }}>
      <div className={`fr-ok ${p.kind}`}>
        <span className="tick" aria-hidden>✓</span>
        <h2 id="fr-ok-h">{p.kind === 'sent' ? `Round ${p.round} sent` : `${p.noun[0].toUpperCase()}${p.noun.slice(1)} approved`}</h2>
        <p>{p.kind === 'sent' ? <>Thank you. We have your {plural(p.comments, 'comment')}{p.pages ? <> on {plural(p.pages, 'page')}</> : null}. Reyal Design has been notified and you&apos;ll get an email when the next version is ready.</> : `Thank you. Your ${p.noun} is approved as final.`}</p>
        <div className="card">
          {p.kind === 'approved' && <div className="row"><span>Approved on</span><b>{p.date}</b></div>}
          <div className="row"><span>{p.kind === 'sent' ? 'Rounds used' : 'Revision rounds used'}</span><b>{used} of {p.included}</b></div>
          <span className="segs" aria-hidden>{Array.from({ length: Math.min(p.included, 6) }, (_, k) => <i key={k} className={k < used ? 'on' : ''} />)}</span>
          {p.kind === 'sent' && <small>{left > 0 ? `You have ${left === 1 ? 'one more round' : `${left} more rounds`} after this one.` : 'That was your last included round.'}</small>}
        </div>
        <button className="rv-ghost big" autoFocus onClick={p.onClose}>{p.kind === 'sent' ? 'View sent comments' : `View ${p.noun}`}</button>
      </div>
    </div>
  );
}
