/** The Reyal logo. The small mark replaces the full logo when the sidebar is collapsed (see studio.css). */
export default function Brand() {
  return (
    <>
      <img className="brand-logo" src="/reyal-logo.webp" alt="Reyal Studio" width={170} height={28} />
      <img className="brand-icon" src="/reyal-mark.png" alt="" width={28} height={31} />
    </>
  );
}
