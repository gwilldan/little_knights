import { sign, verify } from "jsonwebtoken";

export const AUTH_COOKIE = "lk_auth";
export const AUTH_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type AuthTokenPayload = {
    sub: string;
};

function parseCookieValue(cookieHeader: string | undefined, name: string): string | undefined {
    if (!cookieHeader) {
        return undefined;
    }

    for (const part of cookieHeader.split(";")) {
        const [key, ...valueParts] = part.trim().split("=");
        if (key === name) {
            return decodeURIComponent(valueParts.join("="));
        }
    }

    return undefined;
}

export function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is not set");
    }

    return secret;
}

export function signAuthToken(userId: string): string {
    return sign({ sub: userId }, getJwtSecret(), { expiresIn: "1d" });
}

export function getUserIdFromCookieHeader(cookieHeader: string | undefined): string | null {
    const token = parseCookieValue(cookieHeader, AUTH_COOKIE);
    if (!token) {
        return null;
    }

    try {
        const payload = verify(token, getJwtSecret()) as AuthTokenPayload;
        return typeof payload.sub === "string" ? payload.sub : null;
    } catch {
        return null;
    }
}
