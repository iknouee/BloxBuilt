import Link from 'next/link';

/**
 * Site header: brand + optional "Join Discord" button. Server component — no
 * interactivity needed.
 */
export default function Header() {
  const invite = process.env.NEXT_PUBLIC_DISCORD_INVITE;
  return (
    <header className="site-header">
      <div className="container inner">
        <Link href="/" className="brand">
          <span className="logo">🏡</span>
          <span>
            BloxBuilt <small>· Bloxburg Builds</small>
          </span>
        </Link>
        <div className="header-actions">
          {invite ? (
            <a className="btn btn-primary" href={invite} target="_blank" rel="noopener noreferrer">
              Join Discord
            </a>
          ) : null}
        </div>
      </div>
    </header>
  );
}
