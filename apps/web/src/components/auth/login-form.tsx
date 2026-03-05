"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError, api } from "@/lib/api-client"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/hooks/use-auth"
import Link from "next/link"
import { Loader2 } from "lucide-react"

const loginSchema = z.object({
  identifier: z.string().min(1, "请输入邮箱或手机号"),
  password: z.string().min(6, "密码至少 6 位"),
})

type LoginValues = z.infer<typeof loginSchema>

export function LoginForm() {
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState("")
  const router = useRouter()
  const { mutate } = useAuth()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginValues) {
    setIsLoading(true)
    setError("")

    try {
      await api.auth.login({
        identifier: data.identifier.trim(),
        password: data.password,
      })
      await mutate() // Revalidate user session
      router.push("/problems")
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as { message?: string };
        setError(data?.message || "登录失败，请检查账号密码");
      } else {
        setError("登录失败，请检查账号密码");
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="identifier">账号</Label>
            <Input
              id="identifier"
              placeholder="name@example.com / 13800000000"
              type="text"
              autoCapitalize="none"
              autoComplete="username"
              autoCorrect="off"
              disabled={isLoading}
              {...register("identifier")}
            />
            {errors.identifier && (
              <p className="text-sm text-destructive">{errors.identifier.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              支持邮箱或手机号登录，系统会自动识别并规范化格式。
            </p>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">密码</Label>
              <Link
                href="/forgot-password"
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                忘记密码?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoCapitalize="none"
              autoComplete="current-password"
              disabled={isLoading}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
          {error ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <Button className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            登录
          </Button>
        </div>
      </form>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            还没有账号?
          </span>
        </div>
      </div>
      <Button className="w-full" variant="outline" type="button" disabled={isLoading} asChild>
        <Link href="/register">注册账号</Link>
      </Button>
    </div>
  )
}
