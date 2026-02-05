"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const jobNumber = searchParams.get("jobNumber");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold text-brand-700">
            Sprinkler Blowouts
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-xl border bg-white p-8 shadow-sm">
          <div className="mb-4 text-5xl">&#10003;</div>
          <h1 className="mb-2 text-2xl font-bold text-brand-700">
            Booking Submitted!
          </h1>
          <p className="mb-6 text-gray-600">
            Your sprinkler blowout request has been received. We&apos;re
            processing your address and will match you with available dates.
          </p>

          {jobNumber && (
            <div className="mb-6 rounded-lg bg-brand-50 p-4">
              <p className="text-sm text-gray-600">Your Job Number</p>
              <p className="text-3xl font-bold tracking-wider text-brand-700">
                {jobNumber}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Save this to check or update your booking
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Link
              href={jobNumber ? `/lookup/${jobNumber}` : "/lookup"}
              className="inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              View Booking Details
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <ConfirmationContent />
    </Suspense>
  );
}
