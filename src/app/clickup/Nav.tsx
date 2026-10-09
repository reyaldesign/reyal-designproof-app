import { clickupAvailable, errorText, isConnected } from '@/lib/clickup';
import { navData } from '@/lib/clickupData';
import NavPanel from './NavPanel';

/** Loads the ClickUp panel's tree. It sits in a Suspense boundary, so the page itself never waits for it. */
export default async function Nav({ userId, userName }: { userId: string; userName: string }) {
  if (!clickupAvailable() || !(await isConnected(userId))) return null;
  try {
    return <NavPanel nav={await navData(userId)} userId={userId} userName={userName} />;
  } catch (e) {
    return <nav className="cu-nav"><div className="cu-nh"><div className="cu-nt"><span>ClickUp</span></div></div><div className="cu-error" role="alert" style={{ margin: 12 }}>{errorText(e)}</div></nav>;
  }
}
