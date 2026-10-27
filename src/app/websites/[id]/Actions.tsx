'use client';

import Link from 'next/link';
import SubmitButton from '@/components/SubmitButton';
import { checkOne, deleteWebsite } from '../actions';

export default function Actions({ id, name, canCheck }: { id: string; name: string; canCheck: boolean }) {
  return (
    <div className="head-actions">
      {canCheck && <form action={checkOne}><input type="hidden" name="id" value={id} /><SubmitButton className="btn" pending="Checking…">Check now</SubmitButton></form>}
      <Link className="btn" href={`/websites?edit=${id}`}>Edit</Link>
      <form action={deleteWebsite} onSubmit={(e) => { if (!confirm(`Delete "${name}" and its uptime history? This cannot be undone.`)) e.preventDefault(); }}>
        <input type="hidden" name="id" value={id} />
        <button className="btn-ghost" style={{ color: 'var(--bad)' }}>Delete</button>
      </form>
    </div>
  );
}
