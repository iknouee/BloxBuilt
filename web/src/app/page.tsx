import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Gallery from '@/components/Gallery';

export const dynamic = 'force-dynamic';

/**
 * Public home page: hero + build gallery.
 */
export default function HomePage() {
  const invite = process.env.NEXT_PUBLIC_DISCORD_INVITE;
  return (
    <>
      <Header />
      <main className="container">
        <section className="hero">
          <span className="eyebrow rise">
            <span className="live" /> Free right now
          </span>
          <h1 className="rise" style={{ animationDelay: '0.05s' }}>
            Your dream Bloxburg home,
            <br />
            <span className="grad">auto-built for you</span>
          </h1>
          <p className="rise" style={{ animationDelay: '0.1s' }}>
            Browse our builds, copy a Build ID, and open an order in our Discord. Our team hops
            onto your plot and builds it — you just bring the in-game money and gamepasses.
          </p>
          <div className="cta rise" style={{ animationDelay: '0.15s' }}>
            {invite ? (
              <a
                className="btn btn-primary btn-lg"
                href={invite}
                target="_blank"
                rel="noopener noreferrer"
              >
                Join the Discord
              </a>
            ) : null}
            <a className="btn btn-lg" href="#builds">
              Browse Builds
            </a>
          </div>

          <div className="hero-stats rise" style={{ animationDelay: '0.2s' }}>
            <div className="hero-stat">
              <div className="n">Auto</div>
              <div className="l">Built for you</div>
            </div>
            <div className="hero-stat">
              <div className="n">Free</div>
              <div className="l">No service fees</div>
            </div>
            <div className="hero-stat">
              <div className="n">Fast</div>
              <div className="l">Quick turnaround</div>
            </div>
          </div>
        </section>

        <section id="builds">
          <div className="section-head">
            <div>
              <h2>Available Builds</h2>
              <p>Pick one you like and copy its Build ID.</p>
            </div>
          </div>
          <Gallery />
        </section>
      </main>
      <Footer />
    </>
  );
}
