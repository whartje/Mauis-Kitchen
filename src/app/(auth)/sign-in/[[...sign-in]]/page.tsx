import { SignIn } from "@clerk/nextjs";
import { CatIcon } from "@/components/ui/cat-icon";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center mb-8">
        <CatIcon className="w-24 h-24 text-brand-orange mb-3" />
        <h1 className="font-display text-3xl text-foreground tracking-tight">
          Maui&apos;s Kitchen
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Sign in to your kitchen
        </p>
      </div>
      <SignIn />
    </div>
  );
}
