import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv, isSupabaseConfigured } from "@/lib/env";

const PUBLIC_PATHS = ["/", "/login", "/signup", "/auth", "/offline", "/setup"];

function isPublic(path: string) {
  return PUBLIC_PATHS.some((p) => path === p || (p !== "/" && path.startsWith(`${p}/`)));
}

export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    if (isPublic(request.nextUrl.pathname)) return NextResponse.next();
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Refreshes the session if expired. Do not remove.
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  if (!user && !isPublic(path)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  if (user && (path === "/login" || path === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return response;
}
