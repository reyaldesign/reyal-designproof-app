'use client';

import { useLang } from './Lang';
import { refreshAiStatus, useAiStatus } from './useAiStatus';

const LABEL = { checking: 'Checking…', active: 'AI active', degraded: 'AI slow', down: 'AI down' } as const;

/** The live AI indicator. Click it to check again. `row` is the roomier version used in the session panel. */
export default function AiStatus({ variant = 'pill' }: { variant?: 'pill' | 'row' }) {
  const s = useAiStatus();
  const { t, msg } = useLang();
  if (variant === 'row') {
    return (
      <div className={`ai-statusrow ${s.state}`}>
        <div><span>{t('AI status')}</span><b><i className="ai-dot" />{t(LABEL[s.state])}</b></div>
        {s.state !== 'active' && s.state !== 'checking' && <p>{msg(s.reason)}</p>}
        <button className="ai-link" onClick={() => refreshAiStatus(true)}>{t('Check again')}</button>
      </div>
    );
  }
  return (
    <button className={`ai-status ${s.state}`} onClick={() => refreshAiStatus(true)} title={`${msg(s.reason)} ${t('Click to check again.')}`} aria-live="polite">
      <i className="ai-dot" />{t(LABEL[s.state])}
    </button>
  );
}
