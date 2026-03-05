import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"
import { AuthShell } from "@/components/patterns/auth-shell"
import { Card, CardContent } from "@/components/ui/card"

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Auth / Recovery"
      title="找回密码"
      description="使用和登录相同的标识符获取验证码，重置后自动建立新会话。"
    >
      <Card className="mx-auto max-w-xl">
        <CardContent className="space-y-6 px-6 py-7 md:px-8 md:py-9">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">找回密码</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              验证码会按你输入的标识符类型，通过邮件或短信发送。
            </p>
          </div>
          <ForgotPasswordForm />
        </CardContent>
      </Card>
    </AuthShell>
  )
}
