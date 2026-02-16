"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { bookingSchema, type BookingInput } from "@/lib/validation";
import { SERVICE_TYPE_OPTIONS } from "@/lib/service-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { BookingCalendar } from "./booking-calendar";
import { TimeGrid } from "./time-grid";

const timeOptions = [
  { value: "MORNING", label: "Morning (8 AM - 12 PM)" },
  { value: "AFTERNOON", label: "Afternoon (12 PM - 4 PM)" },
  { value: "EVENING", label: "Evening (4 PM - 7 PM)" },
];

const steps = ["Service", "Contact Info", "Address", "Time Preference", "Select Date", "Select Time"];

interface GeoData {
  lat: number;
  lng: number;
  zoneId: string;
  zoneName: string;
}

interface AvailableDate {
  id: string;
  date: string;
  dayOfWeek: string;
  spotsRemaining: number;
  availableTimes: string[];
}

export function BookingForm() {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [validatingAddress, setValidatingAddress] = useState(false);
  const [loadingDates, setLoadingDates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoData, setGeoData] = useState<GeoData | null>(null);
  const [availableDates, setAvailableDates] = useState<AvailableDate[]>([]);
  const [selectedDateId, setSelectedDateId] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isFirstInZone, setIsFirstInZone] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BookingInput>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      state: "WA",
    },
  });

  const selectedServiceType = watch("serviceType");

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && step < steps.length - 1) {
      e.preventDefault();
      nextStep();
    }
  };

  const nextStep = async () => {
    const fieldsToValidate: (keyof BookingInput)[][] = [
      ["serviceType"],
      ["customerName", "customerEmail", "customerPhone"],
      ["address", "city", "state", "zip"],
      ["preferredTime"],
      [], // Step 4: date selection validated separately
      [], // Step 5: time selection validated separately
    ];

    const valid = await trigger(fieldsToValidate[step]);
    if (!valid) return;

    // Validate address and get zone info before proceeding to time selection
    if (step === 2) {
      setValidatingAddress(true);
      setError(null);

      try {
        const { address, city, state, zip } = getValues();
        const res = await fetch("/api/validate-address", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, city, state, zip }),
        });

        const result = await res.json();

        if (!result.valid) {
          setError(result.error || "We couldn't verify this address. Please check and try again.");
          return;
        }

        if (!result.isInServiceArea) {
          setError("Sorry, we don't currently service your area. Please check back later as we expand our service zones.");
          return;
        }

        // Store geo data for later use
        setGeoData({
          lat: result.lat,
          lng: result.lng,
          zoneId: result.zoneId,
          zoneName: result.zoneName,
        });
      } catch {
        setError("Failed to validate address. Please try again.");
        return;
      } finally {
        setValidatingAddress(false);
      }
    }

    // Fetch available dates after time preference is selected
    if (step === 3) {
      if (!geoData) {
        setError("Address data missing. Please go back and re-enter your address.");
        return;
      }

      setLoadingDates(true);
      setError(null);

      try {
        const { preferredTime, serviceType } = getValues();
        const res = await fetch(
          `/api/geogroup-availability?zoneId=${geoData.zoneId}&timeOfDay=${preferredTime}&serviceType=${serviceType}`
        );

        if (!res.ok) {
          throw new Error("Failed to fetch available dates");
        }

        const result = await res.json();
        setAvailableDates(result.availableDates);
        setIsFirstInZone(result.isFirstInZone);
        setSelectedDateId(null); // Reset selection when dates change
        setSelectedTime(null); // Reset time selection when dates change

        if (result.availableDates.length === 0) {
          setError("No available dates for this time slot. Please try a different time preference.");
          return;
        }
      } catch {
        setError("Failed to load available dates. Please try again.");
        return;
      } finally {
        setLoadingDates(false);
      }
    }

    // Validate date selection before proceeding to time selection
    if (step === 4) {
      if (!selectedDateId) {
        setError("Please select an available date.");
        return;
      }
      // Reset time selection when moving to time step
      setSelectedTime(null);
    }

    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  // Get the selected date object to access available times
  const selectedDateObj = availableDates.find((d) => d.id === selectedDateId);

  // Handle date selection and reset time
  const handleDateSelect = (dateId: string) => {
    setSelectedDateId(dateId);
    setSelectedTime(null); // Reset time when date changes
  };

  const onSubmit = async (data: BookingInput) => {
    if (!selectedDateId) {
      setError("Please select an available date.");
      return;
    }

    if (!selectedTime) {
      setError("Please select an available time.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const bookingData = {
        ...data,
        lat: geoData?.lat,
        lng: geoData?.lng,
        zoneId: geoData?.zoneId,
        availableDateId: selectedDateId,
        bookedTime: selectedTime,
      };

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create booking");
      }

      const result = await res.json();
      router.push(`/booking/confirmation?jobNumber=${result.jobNumber}&serviceType=${data.serviceType}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Step indicator */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                i <= step
                  ? "bg-brand-600 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`ml-2 text-sm ${
                i <= step ? "text-gray-900" : "text-gray-400"
              }`}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <div className="mx-4 h-px w-8 bg-gray-300" />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} onKeyDown={handleKeyDown} className="space-y-6">
        {/* Step 0: Service Type */}
        {step === 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 text-center">
              What service do you need?
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {SERVICE_TYPE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`relative flex cursor-pointer rounded-xl border-2 p-6 transition-all ${
                    selectedServiceType === option.value
                      ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    value={option.value}
                    className="sr-only"
                    {...register("serviceType")}
                  />
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{option.label}</p>
                  </div>
                  {selectedServiceType === option.value && (
                    <div className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white text-sm">
                      &#10003;
                    </div>
                  )}
                </label>
              ))}
            </div>
            {errors.serviceType && (
              <p className="text-sm text-red-600">{errors.serviceType.message}</p>
            )}
          </div>
        )}

        {/* Step 1: Contact Info */}
        {step === 1 && (
          <div className="space-y-4">
            <Input
              label="Full Name"
              id="customerName"
              placeholder="John Smith"
              error={errors.customerName?.message}
              {...register("customerName")}
            />
            <Input
              label="Email"
              id="customerEmail"
              type="email"
              placeholder="john@example.com"
              error={errors.customerEmail?.message}
              {...register("customerEmail")}
            />
            <Input
              label="Phone (optional)"
              id="customerPhone"
              type="tel"
              placeholder="(509) 555-1234"
              error={errors.customerPhone?.message}
              {...register("customerPhone")}
            />
          </div>
        )}

        {/* Step 2: Address */}
        {step === 2 && (
          <div className="space-y-4">
            <Input
              label="Street Address"
              id="address"
              placeholder="123 Main St"
              error={errors.address?.message}
              {...register("address")}
            />
            <div className="grid grid-cols-6 gap-4">
              <div className="col-span-3">
                <Input
                  label="City"
                  id="city"
                  placeholder="Richland"
                  error={errors.city?.message}
                  {...register("city")}
                />
              </div>
              <div className="col-span-1">
                <Input
                  label="State"
                  id="state"
                  placeholder="WA"
                  maxLength={2}
                  error={errors.state?.message}
                  {...register("state")}
                />
              </div>
              <div className="col-span-2">
                <Input
                  label="ZIP Code"
                  id="zip"
                  placeholder="99353"
                  error={errors.zip?.message}
                  {...register("zip")}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Time Preference */}
        {step === 3 && (
          <div className="space-y-4">
            <Select
              label="Preferred Time of Day"
              id="preferredTime"
              options={timeOptions}
              placeholder="Select a time..."
              defaultValue=""
              error={errors.preferredTime?.message}
              {...register("preferredTime")}
            />
            <div className="space-y-1">
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                rows={3}
                className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="Gate code, special instructions, etc."
                {...register("notes")}
              />
            </div>
          </div>
        )}

        {/* Step 4: Select Date */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Select Your Appointment Date
              </h3>
              {geoData && (
                <p className="text-sm text-gray-500">
                  Service Zone: {geoData.zoneName}
                </p>
              )}
              {isFirstInZone && (
                <p className="text-sm text-brand-600 mt-1">
                  You're the first in your area! Choose any available date.
                </p>
              )}
            </div>

            {availableDates.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No available dates for this time slot. Please go back and select a different time preference.
              </div>
            ) : (
              <BookingCalendar
                availableDates={availableDates}
                selectedDateId={selectedDateId}
                onSelectDate={handleDateSelect}
              />
            )}
          </div>
        )}

        {/* Step 5: Select Time */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Select Your Appointment Time
              </h3>
              {selectedDateObj && (
                <p className="text-sm text-gray-500">
                  {selectedDateObj.dayOfWeek}, {selectedDateObj.date}
                </p>
              )}
            </div>

            {selectedDateObj ? (
              <TimeGrid
                availableTimes={selectedDateObj.availableTimes}
                selectedTime={selectedTime}
                onSelectTime={setSelectedTime}
              />
            ) : (
              <div className="text-center py-8 text-gray-500">
                Please go back and select a date.
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          {step > 0 ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setError(null);
                setStep((s) => s - 1);
              }}
            >
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < steps.length - 1 ? (
            <Button
              type="button"
              onClick={nextStep}
              disabled={validatingAddress || loadingDates || (step === 4 && !selectedDateId)}
            >
              {validatingAddress
                ? "Validating Address..."
                : loadingDates
                ? "Loading Dates..."
                : "Continue"}
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={submitting || !selectedDateId || !selectedTime}
            >
              {submitting ? "Submitting..." : "Book Now"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
