import { getAccessToken } from './auth.js';

export async function createEvent(
  userPrincipalName: string,
  eventDetails: {
    subject: string;
    content: string;
    startDateTime: string; // ISO string
    endDateTime: string;   // ISO string
    timeZone?: string;     // Optional, default to UTC
  }
) {
  const token = await getAccessToken();

  const event = {
    subject: eventDetails.subject,
    body: {
      contentType: "HTML",
      content: eventDetails.content,
    },
    start: {
      dateTime: eventDetails.startDateTime,
      timeZone: eventDetails.timeZone || "UTC",
    },
    end: {
      dateTime: eventDetails.endDateTime,
      timeZone: eventDetails.timeZone || "UTC",
    },
  };

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${userPrincipalName}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`❌ Failed to create event: ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return data;
}