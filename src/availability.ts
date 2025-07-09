import { getAccessToken } from "./auth.js";

export async function checkUserAvailability(
  userPrincipalName: string,
  startTime: string, // ISO string like "2025-07-09T09:00:00Z"
  endTime: string     // ISO string like "2025-07-09T17:00:00Z"
) {
  const token = await getAccessToken();

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
          dateTime: startTime,
          timeZone: "Asia/Beirut",
        },
        endTime: {
          dateTime: endTime,
          timeZone: "Asia/Beirut",
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

export async function findAvailability(email: string, startTime: string, endTime: string) {
  try {
    const availability = await checkUserAvailability(email, startTime, endTime);
    return availability;
  } catch (error: any) {
    throw new Error(
      `❌ Failed to find availability for ${email}: ${error.message || error}`
    );
  }
}

