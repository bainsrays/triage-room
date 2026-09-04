import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="text-[24px] font-semibold text-ink">Page not found</h1>
      <p className="mt-2 text-[14px] text-muted">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn btn-primary mt-5">
        Back to landing
      </Link>
    </div>
  );
}
