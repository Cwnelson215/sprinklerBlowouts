import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import { sendEmail } from "../email/ses";
import {
  confirmationEmail,
  reminderEmail,
  updateEmail,
  cancellationEmail,
} from "../email/templates";
import { scheduleJob, JOBS } from "../queue";
import { Booking, AvailableDate, EmailLog, EmailType } from "../types";

interface SendEmailData {
  bookingId: string;
  emailType: EmailType;
  updateDescription?: string;
}

interface SendRemindersData {
  recurring?: boolean;
  cron?: string;
  timezone?: string;
}

export async function handleSendEmail(data: SendEmailData) {
  const { bookingId, emailType, updateDescription } = data;
  const db = await getDb();

  const booking = await db.collection<Booking>("bookings").findOne({
    _id: new ObjectId(bookingId),
  });

  if (!booking) {
    console.error(`Booking ${bookingId} not found for email`);
    return;
  }

  let availableDate: AvailableDate | null = null;
  if (booking.availableDateId) {
    availableDate = await db.collection<AvailableDate>("available_dates").findOne({
      _id: booking.availableDateId,
    });
  }

  const info = {
    jobNumber: booking.jobNumber,
    customerName: booking.customerName,
    address: booking.address,
    city: booking.city,
    state: booking.state,
    zip: booking.zip,
    date: availableDate
      ? availableDate.date.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : undefined,
    timeOfDay: availableDate?.timeOfDay,
    serviceType: booking.serviceType,
  };

  let email: { subject: string; html: string };

  switch (emailType) {
    case "CONFIRMATION":
      email = confirmationEmail(info);
      break;
    case "REMINDER":
      email = reminderEmail(info);
      break;
    case "UPDATE":
      email = updateEmail(info, updateDescription || "Your booking details have been updated.");
      break;
    case "CANCELLATION":
      email = cancellationEmail(info);
      break;
    default:
      console.error(`Unknown email type: ${emailType}`);
      return;
  }

  await sendEmail({
    to: booking.customerEmail,
    subject: email.subject,
    html: email.html,
    bookingId: booking._id.toHexString(),
    emailType,
  });
}

export async function handleSendReminders(_data: SendRemindersData) {
  const db = await getDb();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  // Get available dates for tomorrow
  const availableDates = await db.collection<AvailableDate>("available_dates")
    .find({
      date: { $gte: tomorrow, $lt: dayAfter },
    })
    .toArray();

  const availableDateIds = availableDates.map((d) => d._id);

  const bookings = await db.collection<Booking>("bookings")
    .find({
      status: { $in: ["SCHEDULED", "CONFIRMED"] },
      availableDateId: { $in: availableDateIds },
    })
    .toArray();

  for (const booking of bookings) {
    // Check if reminder already sent
    const existingReminder = await db.collection<EmailLog>("email_logs").findOne({
      bookingId: booking._id,
      emailType: "REMINDER",
      sentAt: { $gte: tomorrow },
    });

    if (!existingReminder) {
      await scheduleJob(JOBS.SEND_EMAIL, {
        bookingId: booking._id.toHexString(),
        emailType: "REMINDER" as EmailType,
      });
    }
  }

  console.log(`Queued reminders for ${bookings.length} bookings`);
}
