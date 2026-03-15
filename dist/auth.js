import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const REFRESH_BUFFER_SECONDS = 60;
let tokenState = null;
function initTokenState() {
    const accessToken = process.env.MYCASH_ACCESS_TOKEN;
    const refreshToken = process.env.MYCASH_REFRESH_TOKEN;
    const expiresAt = process.env.MYCASH_TOKEN_EXPIRES_AT;
    if (!accessToken || !refreshToken) {
        throw new Error('MYCASH_ACCESS_TOKEN and MYCASH_REFRESH_TOKEN must be set in environment');
    }
    return {
        accessToken,
        refreshToken,
        expiresAt: expiresAt ? parseInt(expiresAt) : Math.floor(Date.now() / 1000) + 3600,
    };
}
export async function getAccessToken() {
    if (!tokenState) {
        tokenState = initTokenState();
    }
    const now = Math.floor(Date.now() / 1000);
    const isExpiringSoon = tokenState.expiresAt - now < REFRESH_BUFFER_SECONDS;
    if (isExpiringSoon) {
        tokenState = await refreshTokens(tokenState.refreshToken);
    }
    return tokenState.accessToken;
}
export async function refreshTokens(refreshToken) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false },
    });
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) {
        throw new Error(`Token refresh failed: ${error?.message ?? 'No session returned'}`);
    }
    const newState = {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
    };
    // Persist updated tokens to env so future processes can reuse them
    process.env.MYCASH_ACCESS_TOKEN = newState.accessToken;
    process.env.MYCASH_REFRESH_TOKEN = newState.refreshToken;
    process.env.MYCASH_TOKEN_EXPIRES_AT = String(newState.expiresAt);
    return newState;
}
export async function handleUnauthorized() {
    if (!tokenState) {
        tokenState = initTokenState();
    }
    tokenState = await refreshTokens(tokenState.refreshToken);
}
