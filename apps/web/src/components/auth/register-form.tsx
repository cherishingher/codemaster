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

const registerSchema = z.object({
  identifier: z.string().min(3, "请输入邮箱或手机号"),
  code: z.string().min(4, "请输入验证码"),
  password: z.string().min(8, "密码至少 8 位"),
  confirmPassword: z.string().min(8, "密码至少 8 位"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "两次输入的密码不一致",
  path: ["confirmPassword"],
})

type RegisterValues = z.infer<typeof registerSchema>

export function RegisterForm() {
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSending, setIsSending] = React.useState(false)
  const [countdown, setCountdown] = React.useState(0)
  const [notice, setNotice] = React.useState("")
  const [debugCode, setDebugCode] = React.useState("")
  const [error, setError] = React.useState("")
  const router = useRouter()
  const { mutate } = useAuth()

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
  })

  React.useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown])

  async function handleSendCode() {
    setError("")
    setNotice("")
    setDebugCode("")
    const identifier = getValues("identifier")
    if (!identifier) {
      setError("请先输入邮箱或手机号")
      return
    }
    setIsSending(true)
    try {
      const res = await api.auth.requestCode({ identifier, purpose: "register" }) as { debugCode?: string }
      setNotice("验证码已发送，请查收")
      if (res?.debugCode) {
        setDebugCode(res.debugCode)
      }
      setCountdown(60)
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as { message?: string }
        setError(data?.message || "发送验证码失败")
      } else {
        setError("发送验证码失败")
      }
    } finally {
      setIsSending(false)
    }
  }

  async function onSubmit(data: RegisterValues) {
    setIsLoading(true)
    setError("")
    setNotice("")

    try {
      await api.auth.register({
        identifier: data.identifier,
        code: data.code,
        password: data.password,
      })
      await mutate()
      router.push("/problems")
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as { message?: string };
        setError(data?.message || "注册失败，请稍后重试");
      } else {
        setError("注册失败，请稍后重试");
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
            <Label htmlFor="identifier">邮箱或手机号</Label>
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
          </div>
          <div className="grid gap-2">
            <Label htmlFor="code">验证码</Label>
            <div className="flex gap-2">
              <Input
                id="code"
                placeholder="6 位验证码"
                type="text"
                disabled={isLoading}
                {...register("code")}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleSendCode}
                disabled={isSending || countdown > 0}
              >
                {isSending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {countdown > 0 ? `${countdown}s` : "发送验证码"}
              </Button>
            </div>
            {errors.code && (
              <p className="text-sm text-destructive">{errors.code.message}</p>
            )}
            {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
            {debugCode ? (
              <p className="text-sm text-amber-500">测试验证码: {debugCode}</p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              disabled={isLoading}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">确认密码</Label>
            <Input
              id="confirmPassword"
              type="password"
              disabled={isLoading}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            注册
          </Button>
        </div>
      </form>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            已有账号?
          </span>
        </div>
      </div>
      <Button variant="outline" type="button" disabled={isLoading} asChild>
        <Link href="/login">登录</Link>
      </Button>
    </div>
  )
}
