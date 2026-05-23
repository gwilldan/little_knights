import type { LoaderFunctionArgs } from "react-router";

export async function loader(_args: LoaderFunctionArgs) {
  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "public, max-age=86400"
    }
  });
}
