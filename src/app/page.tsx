import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold text-brand-700">
            Sprinkler Services
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
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-16">
        <div className="text-center">
          <h2 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Professional Sprinkler Services
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
            From winterization blowouts to annual backflow prevention testing,
            we keep your irrigation system safe and compliant year-round.
          </p>
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          <div className="flex flex-col rounded-xl border bg-white p-8 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-900">Sprinkler Blowout</h3>
            <p className="mt-3 text-gray-600">
              Protect your irrigation system from freeze damage. We use
              compressed air to blow out all remaining water from your sprinkler
              lines, heads, and valves.
            </p>
            <div className="mt-auto" />
            <Link
              href="/booking?service=SPRINKLER_BLOWOUT"
              className="mt-6 self-start rounded-md bg-brand-600 px-4 py-1.5 text-base font-semibold text-white shadow-sm hover:bg-brand-700 text-center"
            >
              Book a Blowout
            </Link>
          </div>
          <div className="flex flex-col rounded-xl border bg-white p-8 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-900">Backflow Prevention Testing</h3>
            <p className="mt-3 text-gray-600">
              Annual backflow preventer testing to keep your water supply safe
              and compliant with local regulations.
            </p>
            <div className="mt-auto" />
            <Link
              href="/booking?service=BACKFLOW_TESTING"
              className="mt-6 self-start rounded-md bg-brand-600 px-4 py-1.5 text-base font-semibold text-white shadow-sm hover:bg-brand-700 text-center"
            >
              Book a Backflow Test
            </Link>
          </div>
        </div>

        <div className="mt-24 grid gap-8 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4 text-3xl">1</div>
            <h3 className="text-lg font-semibold">Choose Your Service</h3>
            <p className="mt-2 text-sm text-gray-600">
              Select the service you need and enter your address.
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
        Sprinkler Services
      </footer>
    </div>
  );
}
