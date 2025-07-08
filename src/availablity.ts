import { getAccessToken } from "./auth.js";

export async function checkUserAvailability(userPrincipalName: string) {
  const token = await getAccessToken();

  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${userPrincipalName}/calendar/getSchedule`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schedules: [userPrincipalName],
        startTime: {
          dateTime: now.toISOString(),
          timeZone: "UTC",
        },
        endTime: {
          dateTime: oneHourLater.toISOString(),
          timeZone: "UTC",
        },
        availabilityViewInterval: 30,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Graph API error: ${JSON.stringify(data)}`);
  }

  return data;
}

export async function findAvailability(email: string) {
  try {
    const availability = await checkUserAvailability(email);
    return availability;
  } catch (error: any) {
    throw new Error(
      `❌ Failed to find availability for ${email}: ${error.message || error}`
    );
  }
}
