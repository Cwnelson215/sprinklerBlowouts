import Link from "next/link";
import { redirect } from "next/navigation";
import { BookingForm } from "@/components/booking/booking-form";
import { ServiceType } from "@/lib/types";
import { getServiceConfig } from "@/lib/service-config";

const validServiceTypes = new Set(Object.values(ServiceType));

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const { service } = await searchParams;

  if (!service || !validServiceTypes.has(service as ServiceType)) {
    redirect("/");
  }

  const serviceType = service as ServiceType;
  const config = getServiceConfig(serviceType);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold text-brand-700">
            Sprinkler Services
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="mb-2 text-2xl font-bold">{config.bookingHeading}</h1>
        <p className="mb-8 text-gray-600">{config.bookingSubheading}</p>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <BookingForm serviceType={serviceType} />
        </div>
      </main>
    </div>
  );
}
