import { RegisterForm } from "@/components/auth/register-form"
import { AuthShell } from "@/components/patterns/auth-shell"
import { Card, CardContent } from "@/components/ui/card"

export default function RegisterPage() {
  return (
    <AuthShell
      eyebrow="Auth / Sign Up"
      title="创建账户"
      description="邮箱和手机号共用同一套注册界面。后续批次会沿用这套高密度表单和状态反馈规范。"
    >
      <Card className="mx-auto max-w-xl">
        <CardContent className="space-y-6 px-6 py-7 md:px-8 md:py-9">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">创建账户</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              输入邮箱或手机号获取验证码，再设置密码完成注册。
            </p>
          </div>
          <RegisterForm />
        </CardContent>
      </Card>
    </AuthShell>
  )
}
