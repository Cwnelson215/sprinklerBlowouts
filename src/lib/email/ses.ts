import { ObjectId } from "mongodb";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { getDb } from "../mongodb";
import { EmailType } from "../types";

const ses = new SESClient({ region: process.env.AWS_REGION || "us-east-1" });
const FROM_EMAIL = `noreply@${process.env.EMAIL_DOMAIN || "example.com"}`;

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  bookingId: string;
  emailType: EmailType;
}

export async function sendEmail({
  to,
  subject,
  html,
  bookingId,
  emailType,
}: SendEmailParams): Promise<boolean> {
  const db = await getDb();

  try {
    await ses.send(
      new SendEmailCommand({
        Source: FROM_EMAIL,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject },
          Body: { Html: { Data: html } },
        },
      })
    );

    await db.collection("email_logs").insertOne({
      bookingId: new ObjectId(bookingId),
      emailType,
      to,
      subject,
      success: true,
      sentAt: new Date(),
    });

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await db.collection("email_logs").insertOne({
      bookingId: new ObjectId(bookingId),
      emailType,
      to,
      subject,
      success: false,
      error: message,
      sentAt: new Date(),
    });
    console.error(`Failed to send ${emailType} email to ${to}:`, message);
    return false;
  }
}
