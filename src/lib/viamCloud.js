import { createViamClient } from '@viamrobotics/sdk';
import Cookies from 'js-cookie';

export const ORG_ID = '9c9243cb-6d3a-4aee-914c-a49b43821463';

const LOCATION_ID_RE = /\.([^.]+)\.viam\.cloud/;

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

export async function queryHotTabular(pipeline) {
  const vc = await getViamCloudClient();
  return vc.dataClient.tabularDataByMQL(ORG_ID, pipeline, true);
}

export async function queryColdTabular(pipeline) {
  const vc = await getViamCloudClient();
  return vc.dataClient.tabularDataByMQL(ORG_ID, pipeline, false);
}

export async function queryTabular(pipeline) {
  const hot = await queryHotTabular(pipeline);
  if (hot && hot.length > 0) return hot;
  return queryColdTabular(pipeline);
}
