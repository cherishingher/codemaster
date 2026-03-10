"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { client, ApiError } from "@/lib/api-client";
import { Button, type ButtonProps } from "@/components/ui/button";

type UpgradePlanButtonProps = {
  plan: "guest" | "free" | "paid";
  className?: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
};

type CreateOrderResponse = {
  data: {
    id: string;
  };
};

export function UpgradePlanButton({
  plan,
  className,
  size = "default",
  variant = "default",
}: UpgradePlanButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const order = await client<CreateOrderResponse>("/orders", {
        method: "POST",
        body: JSON.stringify({ productType: "video_membership" }),
      });

      await client(`/orders/${order.data.id}/pay`, {
        method: "POST",
        body: JSON.stringify({ channel: "web-local" }),
      });

      toast.success("付费版已开通");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "开通失败，请检查本地后端和数据库状态";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (plan === "paid") {
    return (
      <Button type="button" size={size} variant="secondary" className={className} disabled>
        已开通付费版
      </Button>
    );
  }

  if (plan === "guest") {
    return (
      <Button asChild size={size} variant={variant} className={className}>
        <Link href="/login">
          登录后开通付费版
          <Sparkles className="size-4" />
        </Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      onClick={handleUpgrade}
      disabled={loading}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
      立即开通付费版
    </Button>
  );
}
