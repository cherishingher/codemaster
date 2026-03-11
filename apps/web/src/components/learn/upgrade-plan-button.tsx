"use client";

import Link from "next/link";
import { Crown, Sparkles } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

type UpgradePlanButtonProps = {
  plan: "guest" | "free" | "paid";
  className?: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
};

export function UpgradePlanButton({
  plan,
  className,
  size = "default",
  variant = "default",
}: UpgradePlanButtonProps) {
  if (plan === "paid") {
    return (
      <Button asChild size={size} variant="secondary" className={className}>
        <Link href="/membership">
          <Crown className="size-4" />
          前往会员中心
        </Link>
      </Button>
    );
  }

  if (plan === "guest") {
    return (
      <Button asChild size={size} variant={variant} className={className}>
        <Link href="/login">
          登录后开通 VIP
          <Sparkles className="size-4" />
        </Link>
      </Button>
    );
  }

  return (
    <Button asChild size={size} variant={variant} className={className}>
      <Link href="/membership">
        <Sparkles className="size-4" />
        立即开通 VIP
      </Link>
    </Button>
  );
}
