import './ErrorBanner.css';

/**
 * Renders nothing when there is no error, so call sites stay
 * `<ErrorBanner message={error} />` rather than `{error && ...}`.
 */
export default function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="errorbanner" role="alert">
      Error: {message}
    </div>
  );
}
