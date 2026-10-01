import { createViamClient } from '@viamrobotics/sdk';
import Cookies from 'js-cookie';

export const ORG_ID = '9c9243cb-6d3a-4aee-914c-a49b43821463';

let clientPromise = null;

export function getViamCloudClient() {
  if (clientPromise) return clientPromise;
  const cookieKey = window.location.pathname.split('/')[2];
  const { apiKey: { id, key } } = JSON.parse(Cookies.get(cookieKey));
  clientPromise = createViamClient({
    credentials: { type: 'api-key', authEntity: id, payload: key },
  }).catch((e) => { clientPromise = null; throw e; });
  return clientPromise;
}
