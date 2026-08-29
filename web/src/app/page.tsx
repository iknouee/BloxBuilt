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
          <h1>
            Your dream Bloxburg home,{' '}
            <span className="grad">auto-built for you</span>
          </h1>
          <p>
            Browse our builds, copy the Build ID you like, then open an order in our Discord.
            Our team hops onto your plot and builds it — you just cover the in-game cost.
          </p>
          <div className="cta">
            {invite ? (
              <a className="btn btn-primary" href={invite} target="_blank" rel="noopener noreferrer">
                Join the Discord
              </a>
            ) : null}
            <a className="btn" href="#builds">
              Browse Builds
            </a>
          </div>
        </section>

        <section id="builds">
          <Gallery />
        </section>
      </main>
      <Footer />
    </>
  );
}
