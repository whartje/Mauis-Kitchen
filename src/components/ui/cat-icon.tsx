import Image from "next/image";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

export function CatIcon({ className }: Props) {
  return (
    <span className={cn("inline-flex items-center justify-center shrink-0", className)}>
      <Image
        src="/maui-cat.png.png"
        alt="Maui's Kitchen"
        width={48}
        height={48}
        className="object-contain w-full h-full brightness-0 dark:invert"
        priority
      />
    </span>
  );
}
