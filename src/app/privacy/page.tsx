export const metadata = { title: "Privacy Policy – Maui's Kitchen" };

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16 prose prose-sm">
      <h1 className="text-2xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-muted-foreground text-sm mb-8">Last updated: May 2026</p>

      <h2 className="text-lg font-semibold mt-8 mb-2">What we collect</h2>
      <p>
        Maui&apos;s Kitchen collects only the information necessary to provide the service:
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Your account credentials (managed by Clerk — we never see your password).</li>
        <li>Recipes, pantry items, meal plans, and grocery lists you create in the app.</li>
        <li>An Alexa account-linking token if you choose to connect the Alexa skill, used solely to sync your pantry with your Alexa grocery list.</li>
      </ul>

      <h2 className="text-lg font-semibold mt-8 mb-2">How we use it</h2>
      <p>
        Your data is used exclusively to operate the Maui&apos;s Kitchen service. We do not sell,
        share, or use your information for advertising.
      </p>

      <h2 className="text-lg font-semibold mt-8 mb-2">Alexa skill</h2>
      <p>
        When you link the Maui&apos;s Kitchen Alexa skill, we store a secure token that identifies
        your account. We use your Alexa household list (with your permission) only to sync items
        against your pantry. We do not retain the contents of your Alexa lists.
      </p>

      <h2 className="text-lg font-semibold mt-8 mb-2">Data retention & deletion</h2>
      <p>
        You may delete your account and all associated data at any time from the Settings page.
      </p>

      <h2 className="text-lg font-semibold mt-8 mb-2">Contact</h2>
      <p>
        Questions? Email{" "}
        <a href="mailto:william.hartje@gmail.com" className="underline">
          william.hartje@gmail.com
        </a>
        .
      </p>
    </div>
  );
}
