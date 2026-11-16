export type PluginRow = { name: string; version: string; active: boolean; update: string | null };

/** One website's plugins: updates first, then the active ones, then the inactive ones. */
export default function PluginList({ plugins }: { plugins: PluginRow[] }) {
  if (!plugins.length) return <p className="muted">No plugins.</p>;
  const sorted = [...plugins].sort((a, b) => Number(!!b.update) - Number(!!a.update) || Number(b.active) - Number(a.active));
  return (
    <table className="ws-mini">
      <thead><tr><th>Plugin</th><th>Version</th><th>Status</th><th /></tr></thead>
      <tbody>{sorted.map((p) => (
        <tr key={p.name} className={p.active ? '' : 'ws-inactive'}>
          <td>{p.name}</td>
          <td>{p.version || '·'}</td>
          <td>{p.active ? 'Active' : 'Inactive'}</td>
          <td>{p.update ? <span className="ws-chip ws-c-wip">Update to {p.update}</span> : null}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}
