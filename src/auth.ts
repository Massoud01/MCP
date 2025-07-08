// auth.ts
import { ConfidentialClientApplication } from '@azure/msal-node';
import {config} from 'dotenv';

config();
const tenantId = process.env.TENANT_ID!;
const clientId = process.env.CLIENT_ID!;
const clientSecret = process.env.CLIENT_SECRET!;
const msalApp = new ConfidentialClientApplication({
  auth: {
    clientId,
    clientSecret,
    authority: `https://login.microsoftonline.com/${tenantId}`,
  },
});

export async function getAccessToken(): Promise<string> {
  const tokenResponse = await msalApp.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default'],
  });

  if (!tokenResponse || !tokenResponse.accessToken) {
    throw new Error('❌ Failed to acquire access token.');
  }

  return tokenResponse.accessToken;
}
