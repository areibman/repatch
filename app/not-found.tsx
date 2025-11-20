import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <h2 className="mb-2 text-2xl font-bold">Not Found</h2>
      <p className="mb-6 text-muted-foreground">
        Could not find the requested resource.
      </p>
      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
      >
        Return Home
      </Link>
    </div>
  );
}

