import Link from "next/link";
import { BookOpen, Facebook, Github, Instagram, Youtube } from "lucide-react";

const productLinks = [
  { label: "题库练习", href: "/problems" },
  { label: "图形化任务", href: "/graphical" },
  { label: "提交记录", href: "/submissions" },
  { label: "个人进度", href: "/profile" },
];

const companyLinks = [
  { label: "平台概览", href: "/" },
  { label: "题库管理", href: "/admin/problems" },
  { label: "题单管理", href: "/admin/problem-sets" },
  { label: "导入导出", href: "/admin/import-export" },
];

const supportLinks = [
  { label: "登录", href: "/login" },
  { label: "注册", href: "/register" },
  { label: "找回密码", href: "/forgot-password" },
  { label: "提交测试", href: "/admin/submit-test" },
  { label: "帮助中心", href: "/admin" },
];

const socialLinks = [
  { label: "GitHub", href: "https://github.com/cherishingher/codemaster", icon: Github },
  { label: "Instagram", href: "#", icon: Instagram },
  { label: "Facebook", href: "#", icon: Facebook },
  { label: "YouTube", href: "#", icon: Youtube },
];

export function Footer() {
  return (
    <footer className="bg-secondary/65">
      <div className="page-wrap py-16 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
          <div className="space-y-6">
            <Link href="/" className="inline-flex items-center gap-4">
              <span className="flex size-14 items-center justify-center rounded-[1.2rem] bg-accent text-foreground">
                <BookOpen className="size-7" />
              </span>
              <span className="text-3xl font-semibold tracking-tight text-foreground">CodeMaster</span>
            </Link>
            <p className="max-w-sm text-lg leading-8 text-muted-foreground">
              统一题库、提交评测、Scratch 图形化和后台管理流程的 OJ 学习平台。
            </p>
            <div className="flex flex-wrap gap-4">
              {socialLinks.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noreferrer" : undefined}
                  aria-label={label}
                  className="flex size-14 items-center justify-center rounded-[1.15rem] bg-background text-foreground shadow-[0_10px_24px_rgba(31,41,55,0.08)] transition-transform hover:-translate-y-0.5"
                >
                  <Icon className="size-6" />
                </a>
              ))}
            </div>
          </div>

          <FooterColumn title="训练入口" links={productLinks} />
          <FooterColumn title="平台" links={companyLinks} />
          <FooterColumn title="支持" links={supportLinks} />
        </div>

        <div className="mt-16 flex flex-col gap-5 border-t border-border/20 pt-8 text-base text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>© 2026 CodeMaster. 保留所有权利。</p>
          <div className="flex flex-wrap gap-6">
            <Link href="/privacy" className="hover:text-foreground">
              隐私
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              条款
            </Link>
            <Link href="/cookies" className="hover:text-foreground">
              Cookie
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

type FooterColumnProps = {
  title: string;
  links: Array<{ label: string; href: string }>;
};

function FooterColumn({ title, links }: FooterColumnProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h3>
      <nav className="flex flex-col gap-4 text-lg text-muted-foreground">
        {links.map((link) => (
          <Link key={link.label} href={link.href} className="hover:text-foreground">
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
