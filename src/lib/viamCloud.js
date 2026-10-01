import { createViamClient } from '@viamrobotics/sdk';
import Cookies from 'js-cookie';

export const ORG_ID = '9c9243cb-6d3a-4aee-914c-a49b43821463';

const LOCATION_ID_RE = /main\.([^.]+)\.viam\.cloud/;

let clientPromise = null;
let cachedLocationId = null;

function readCookiePayload() {
  const cookieKey = window.location.pathname.split('/')[2];
  return JSON.parse(Cookies.get(cookieKey));
}

export function getLocationId() {
  if (cachedLocationId) return cachedLocationId;
  try {
    const { hostname } = readCookiePayload();
    const m = hostname.match(LOCATION_ID_RE);
    cachedLocationId = m ? m[1] : null;
  } catch {
    cachedLocationId = null;
  }
  return cachedLocationId;
}

export function getViamCloudClient() {
  if (clientPromise) return clientPromise;
  const { apiKey: { id, key } } = readCookiePayload();
  clientPromise = createViamClient({
    credentials: { type: 'api-key', authEntity: id, payload: key },
  }).catch((e) => { clientPromise = null; throw e; });
  return clientPromise;
}

// MQL via the hot data store. Pipeline is a list of pipeline stages,
// e.g. [{ $match: {...} }, { $sort: {...} }, { $limit: N }, { $project: {...} }].
// Callers should include organization_id + location_id in their $match
// for performance (both are indexed path components).
export async function queryHotTabular(pipeline) {
  const vc = await getViamCloudClient();
  return vc.dataClient.tabularDataByMQL(ORG_ID, pipeline, true);
}
