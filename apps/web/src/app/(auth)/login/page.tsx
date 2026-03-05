import { LoginForm } from "@/components/auth/login-form"
import { AuthShell } from "@/components/patterns/auth-shell"
import { Card, CardContent } from "@/components/ui/card"

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Auth / Sign In"
      title="登录账户"
      description="使用邮箱或手机号进入你的题库工作区。业务逻辑保持原样，这一批只更新界面和交互层。"
    >
      <Card className="mx-auto max-w-xl">
        <CardContent className="space-y-6 px-6 py-7 md:px-8 md:py-9">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">登录账户</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              请输入你的邮箱或手机号以及密码，系统会自动识别账号类型。
            </p>
          </div>
          <LoginForm />
        </CardContent>
      </Card>
    </AuthShell>
  )
}
