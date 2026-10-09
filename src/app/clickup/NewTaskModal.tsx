'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';
import { MAX_ATTACH_MB, MAX_UPLOAD_MB } from '@/lib/limits';
import { createTask } from './actions';

export type ListCfg = {
  id: string; label: string; code: string; dot: string;
  stages: { value: string; label: string; color: string }[]; stageField: string; // stageField is set when the stages are a dropdown field
  note: { id: string; name: string } | null; // the list's first text field, offered as one extra input
};
type Person = { id: number; name: string; color: string };
type Preset = { label: string; key: string; hint: string };
type Props = { lists: ListCfg[]; listId: string; stage: string; due: string; people: Person[]; tags: string[]; client: string; presets: Preset[]; close: string };

const PRIORITIES = [['1', 'Urgent', '#ff5c6c'], ['2', 'High', '#ffd308'], ['3', 'Normal', '#6aa9ff'], ['4', 'Low', '#8b8b95']] as const;
type Menu = 'list' | 'status' | 'assign' | 'due' | 'pri' | 'tags' | 'create' | null;

/** The "+ Task" popup: pick a list, name the task, set the details, create it. Fields are controlled, so an error from ClickUp keeps everything typed. */
export default function NewTaskModal({ lists, listId, stage, due: dueIn, people, tags, client, presets, close }: Props) {
  const router = useRouter();
  const how = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState(createTask, null as { error?: string } | null);
  const [list, setList] = useState(lists.find((l) => l.id === listId) ?? lists[0]);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [st, setSt] = useState(stage);
  const [who, setWho] = useState<number[]>([]);
  const [due, setDue] = useState(dueIn);
  const [pri, setPri] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [menu, setMenu] = useState<Menu>(null);
  const [files, setFiles] = useState<File[]>([]);

  // The file input is the real form field. These keep it in step with the list shown, and refill it after a failed attempt, since React clears uncontrolled fields.
  const sync = (next: File[]) => { const dt = new DataTransfer(); next.forEach((f) => dt.items.add(f)); if (picker.current) picker.current.files = dt.files; };
  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => { const next = [...files, ...Array.from(e.target.files ?? [])]; setFiles(next); sync(next); };
  const dropFile = (i: number) => { const next = files.filter((_, j) => j !== i); setFiles(next); sync(next); };
  useEffect(() => { sync(files); }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const mb = (n: number) => (n / 1048576 < 0.1 ? '<0.1' : (n / 1048576).toFixed(1)) + ' MB';
  const total = files.reduce((n, f) => n + f.size, 0);
  const fileProblem = files.find((f) => f.size > MAX_ATTACH_MB * 1048576) ? `Each file can be up to ${MAX_ATTACH_MB} MB.` : total > MAX_UPLOAD_MB * 1048576 ? `Attachments can total ${MAX_UPLOAD_MB} MB at most.` : '';

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') router.push(close); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [router, close]);

  const stage1 = list.stages.find((s) => s.value === st) ?? list.stages[0];
  const prio = PRIORITIES.find(([v]) => v === pri);
  const mine = people.filter((p) => who.includes(p.id));
  const toggle = (m: Menu) => () => setMenu(menu === m ? null : m);
  const choose = (list2: ListCfg) => { setList(list2); setSt(list2.stages.some((s) => s.value === st) ? st : list2.stages[0]?.value ?? ''); setNote(''); setMenu(null); };
  const dueLabel = presets.find((p) => p.key === due)?.label ?? (due ? new Date(`${due}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }) : 'Due date');
  const go = (v: string) => () => { if (how.current) how.current.value = v; };

  return (
    <>
      <Link className="cu-overlay" href={close} aria-label="Cancel" />
      <form action={action} className="cu-modal" role="dialog" aria-label="New task">
        <input type="hidden" name="list" value={list.id} /><input type="hidden" name="stage" value={stage1?.value ?? ''} /><input type="hidden" name="stageField" value={list.stageField} />
        <input type="hidden" name="due" value={due} /><input type="hidden" name="priority" value={pri} />
        <input type="hidden" name="noteField" value={list.note?.id ?? ''} /><input type="hidden" name="how" defaultValue="close" ref={how} />
        {who.map((id) => <input key={id} type="hidden" name="assignee" value={id} />)}
        {picked.map((t) => <input key={t} type="hidden" name="tag" value={t} />)}

        <div className="cu-mh"><span className="cu-mtab">Task</span><Link className="cu-mx" href={close} aria-label="Close">×</Link></div>

        <div className="cu-mb">
          <div className="cu-mrel">
            <button type="button" className="cu-mlist" onClick={toggle('list')}><i style={{ background: list.dot }} />{list.label}{list.code && <code>{list.code}</code>}<span>▾</span></button>
            {menu === 'list' && (
              <div className="cu-ddm cu-wide"><span className="cu-mhead">Add to list</span>
                {lists.map((l) => <button key={l.id} type="button" className="cu-opt" onClick={() => choose(l)}><i className="round" style={{ background: l.dot }} /><span className="cu-two"><b>{l.label}</b>{l.code && <code>{l.code}</code>}</span>{l.id === list.id && <em>✓</em>}</button>)}
              </div>
            )}
          </div>

          <input className="cu-mtitle" name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task name" maxLength={200} autoFocus autoComplete="off" />
          <textarea className="cu-mdesc" name="desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Add a description" rows={4} />

          <div className="cu-mrow">
            <div className="cu-mrel">
              <button type="button" className="cu-mstatus" style={{ background: stage1?.color }} onClick={toggle('status')}>{stage1?.label ?? 'Status'}</button>
              {menu === 'status' && <div className="cu-ddm cu-narrow">{list.stages.map((s) => <button key={s.value} type="button" className="cu-opt" onClick={() => { setSt(s.value); setMenu(null); }}><i style={{ background: s.color }} />{s.label}{s.value === stage1?.value && <em>✓</em>}</button>)}</div>}
            </div>

            <div className="cu-mrel">
              <button type="button" className="cu-mpill" onClick={toggle('assign')}>
                {mine.length ? <><span className="cu-mavs">{mine.map((p) => <span key={p.id} style={{ background: p.color }}>{p.name[0]}</span>)}</span>{mine.length === 1 ? mine[0].name.split(' ')[0] : `${mine.length} people`}</> : <><span className="cu-ring" />Assignee</>}
              </button>
              {menu === 'assign' && (
                <div className="cu-ddm">
                  {people.map((p) => <button key={p.id} type="button" className="cu-opt" onClick={() => setWho(who.includes(p.id) ? who.filter((x) => x !== p.id) : [...who, p.id])}><span className="cu-mav" style={{ background: p.color }}>{p.name[0]}</span>{p.name}{who.includes(p.id) && <em>✓</em>}</button>)}
                  {!people.length && <span className="cu-opt muted">No people to choose from.</span>}
                  <button type="button" className="cu-opt muted" onClick={toggle('assign')}>Done</button>
                </div>
              )}
            </div>

            <div className="cu-mrel">
              <button type="button" className="cu-mpill" onClick={toggle('due')}><span className="cu-cal1" />{dueLabel}</button>
              {menu === 'due' && (
                <div className="cu-ddm cu-narrow">
                  {presets.map((p) => <button key={p.key} type="button" className="cu-opt" onClick={() => { setDue(p.key); setMenu(null); }}>{p.label}<small>{p.hint}</small></button>)}
                  <button type="button" className="cu-opt" onClick={() => { setDue(''); setMenu(null); }}>No due date</button>
                  <div className="cu-pick"><input type="date" value={due} onChange={(e) => { setDue(e.target.value); setMenu(null); }} aria-label="Pick a date" /></div>
                </div>
              )}
            </div>

            <div className="cu-mrel">
              <button type="button" className="cu-mpill" onClick={toggle('pri')}><span style={{ color: prio?.[2] ?? '#8b8b95' }}>⚑</span>{prio?.[1] ?? 'Priority'}</button>
              {menu === 'pri' && <div className="cu-ddm cu-narrow">{PRIORITIES.map(([v, label, c]) => <button key={v} type="button" className="cu-opt" onClick={() => { setPri(v); setMenu(null); }}><span style={{ color: c }}>⚑</span>{label}{pri === v && <em>✓</em>}</button>)}</div>}
            </div>

            {!!tags.length && (
              <div className="cu-mrel">
                <button type="button" className="cu-mpill" onClick={toggle('tags')}><span className="muted">#</span>{picked.length ? `${picked.length} tags` : 'Tags'}</button>
                {menu === 'tags' && (
                  <div className="cu-ddm cu-narrow">
                    {tags.map((t) => <button key={t} type="button" className="cu-opt" onClick={() => setPicked(picked.includes(t) ? picked.filter((x) => x !== t) : [...picked, t])}><span className="cu-tagpill">{t}</span>{picked.includes(t) && <em>✓</em>}</button>)}
                    <button type="button" className="cu-opt muted" onClick={toggle('tags')}>Done</button>
                  </div>
                )}
              </div>
            )}
          </div>
          {!!picked.length && <div className="cu-mtags">{picked.map((t) => <span key={t} className="cu-tagpill">{t}</span>)}</div>}

          <div className="cu-mfields">
            <span>Fields</span>
            <div>
              <div><span>Client</span><b>{client}</b></div>
              {list.note && <div><span>{list.note.name}</span><input value={note} onChange={(e) => setNote(e.target.value)} name="note" placeholder={`Add ${list.note.name.toLowerCase()}`} /></div>}
              {list.code && <div><span>List code</span><code>{list.code}</code></div>}
            </div>
          </div>

          <div className="cu-attach">
            <input ref={picker} type="file" name="files" multiple hidden onChange={addFiles} />
            <button type="button" className="cu-mpill" onClick={() => picker.current?.click()}><span aria-hidden="true">📎</span>Attach files</button>
            {files.map((f, i) => <span key={`${f.name}${i}`} className="cu-file1"><b>{f.name}</b><small>{mb(f.size)}</small><button type="button" onClick={() => dropFile(i)} aria-label={`Remove ${f.name}`}>×</button></span>)}
            {fileProblem && <span className="cu-error" role="alert">{fileProblem}</span>}
          </div>
        </div>

        {state?.error && <div className="cu-error" role="alert" style={{ margin: '0 22px 12px' }}>{state.error}</div>}
        <div className="cu-mf">
          <Link className="cu-cancel" href={close}>Cancel</Link>
          <div className="cu-split">
            <button className="cu-create" disabled={!title.trim() || pending || !!fileProblem} onClick={go('close')}>{pending ? (files.length ? 'Uploading…' : 'Creating…') : 'Create task'}</button>
            <button type="button" className="cu-creatememu" onClick={toggle('create')} aria-label="More ways to create" disabled={!title.trim() || pending || !!fileProblem}>▾</button>
            {menu === 'create' && (
              <div className="cu-ddm cu-up">
                <button className="cu-opt" onClick={go('open')}>Create and open</button>
                <button className="cu-opt" onClick={go('another')}>Create and add another</button>
              </div>
            )}
          </div>
        </div>
      </form>
    </>
  );
}
