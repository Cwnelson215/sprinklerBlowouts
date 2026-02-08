import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/geocode";
import { z } from "zod";

const addressSchema = z.object({
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}$/),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = addressSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { valid: false, error: "Invalid address format" },
        { status: 400 }
      );
    }

    const { address, city, state, zip } = parsed.data;
    const result = await geocodeAddress(address, city, state, zip);

    if (!result) {
      return NextResponse.json({
        valid: false,
        error: "We couldn't verify this address. Please check the address and try again.",
      });
    }

    return NextResponse.json({
      valid: true,
      lat: result.lat,
      lng: result.lng,
    });
  } catch (error) {
    console.error("Error validating address:", error);
    return NextResponse.json(
      { valid: false, error: "Failed to validate address" },
      { status: 500 }
    );
  }
}
