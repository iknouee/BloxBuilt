import { isValidAdminSecret, getAdminApiKey } from '@/lib/auth';
import AdminPanel from '@/components/AdminPanel';

export const dynamic = 'force-dynamic';

/**
 * Secret admin page. The URL segment must match ADMIN_SECRET. If it doesn't,
 * we render a neutral "not found" style gate (no hint that this is the admin
 * route). If it matches, we render the panel and pass the API key down so the
 * client can authorize write requests.
 */
export default function AdminSecretPage({ params }: { params: { secret: string } }) {
  if (!isValidAdminSecret(params.secret)) {
    return (
      <main className="container">
        <div className="gate">
          <div>
            <div style={{ fontSize: 42, marginBottom: 10 }}>🔒</div>
            <div>Page not found.</div>
          </div>
        </div>
      </main>
    );
  }

  const apiKey = getAdminApiKey();
  return <AdminPanel apiKey={apiKey} />;
}
