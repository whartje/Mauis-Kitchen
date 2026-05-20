import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/privacy(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/alexa/callback(.*)",
  // Alexa skill endpoints — called by Amazon's servers, not the user's browser
  "/api/alexa/skill-auth(.*)",   // redirects to /alexa/link; must be public so it isn't 401'd
  "/api/alexa/skill-token(.*)",  // Alexa server → token exchange
  "/api/alexa/skill(.*)",        // Alexa server → skill invocation
  // Google OAuth callback is browser-initiated — user is still logged in via Clerk,
  // so we do NOT mark it public. auth() is called inside the route handler.
  "/api/webhooks/(.*)",
  "/api/health",
  // PWA / SEO assets — must be unauthenticated so iOS and crawlers can fetch them
  "/apple-icon.png",
  "/icon.png",
  "/manifest.webmanifest",
  "/api/pwa-icon",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
