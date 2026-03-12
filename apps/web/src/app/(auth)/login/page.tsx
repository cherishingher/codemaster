import { LoginForm } from "@/components/auth/login-form"
import { AuthShell } from "@/components/patterns/auth-shell"
import { Card, CardContent } from "@/components/ui/card"

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Sign In"
      title="登录 CodeMaster"
      description="登录后继续做题、查看学习报告、进入训练路径或管理已购内容。"
    >
      <Card className="mx-auto max-w-xl">
        <CardContent className="space-y-6 px-6 py-7 md:px-8 md:py-9">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">欢迎回来</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              输入邮箱或手机号与密码，继续你的做题、训练和学习计划。
            </p>
          </div>
          <LoginForm />
        </CardContent>
      </Card>
    </AuthShell>
  )
}
