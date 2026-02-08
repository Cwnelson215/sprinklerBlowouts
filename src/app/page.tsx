import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold text-brand-700">
            Sprinkler Blowouts
          </h1>
          <nav className="flex gap-4">
            <Link
              href="/admin/login"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Admin Login
            </Link>
            <Link
              href="/lookup"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Check Booking
            </Link>
            <Link
              href="/booking"
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Book Now
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-16">
        <div className="text-center">
          <h2 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Winterize Your Sprinkler System
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
            Protect your irrigation system from freeze damage. We use
            compressed air to blow out all remaining water from your sprinkler
            lines, heads, and valves.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/booking"
              className="rounded-md bg-brand-600 px-8 py-3 text-lg font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              Schedule Your Blowout
            </Link>
            <Link
              href="/lookup"
              className="rounded-md border border-gray-300 bg-white px-8 py-3 text-lg font-semibold text-gray-700 hover:bg-gray-50"
            >
              Look Up Booking
            </Link>
          </div>
        </div>

        <div className="mt-24 grid gap-8 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4 text-3xl">1</div>
            <h3 className="text-lg font-semibold">Enter Your Address</h3>
            <p className="mt-2 text-sm text-gray-600">
              Tell us where you are and your preferred time of day.
            </p>
          </div>
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4 text-3xl">2</div>
            <h3 className="text-lg font-semibold">Pick a Day</h3>
            <p className="mt-2 text-sm text-gray-600">
              We&apos;ll show available dates based on your area and optimize
              our route.
            </p>
          </div>
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4 text-3xl">3</div>
            <h3 className="text-lg font-semibold">Get Confirmed</h3>
            <p className="mt-2 text-sm text-gray-600">
              Receive a job number and confirmation email. We&apos;ll remind
              you the day before.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t py-8 text-center text-sm text-gray-500">
        Sprinkler Blowout Service
      </footer>
    </div>
  );
}
