import Link from "next/link";
import { BookingForm } from "@/components/booking/booking-form";

export default function BookingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold text-brand-700">
            Sprinkler Blowouts
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-12">
        <h1 className="mb-2 text-2xl font-bold">Schedule Your Blowout</h1>
        <p className="mb-8 text-gray-600">
          Fill out the form below and we&apos;ll get you scheduled.
        </p>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <BookingForm />
        </div>
      </main>
    </div>
  );
}
