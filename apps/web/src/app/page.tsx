import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cpu, GraduationCap, Terminal } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      {/* Hero Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-black relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        <div className="container relative z-10 px-4 md:px-6 flex flex-col items-center text-center">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl/none bg-clip-text text-transparent bg-gradient-to-r from-primary to-white">
              Master the Code
            </h1>
            <p className="mx-auto max-w-[700px] text-gray-400 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Unlock your potential with our advanced coding platform. Practice, compete, and learn with a community of developers.
            </p>
          </div>
          <div className="space-x-4 mt-8">
            <Button asChild size="lg" className="h-12 px-8 text-base">
              <Link href="/problems">开始刷题</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-8 text-base">
              <Link href="/about">了解更多</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-background">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6 lg:grid-cols-3 lg:gap-12">
            <Card className="bg-muted/50 border-0">
              <CardHeader>
                <Terminal className="h-10 w-10 text-primary mb-2" />
                <CardTitle>实时评测</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  支持多语言实时代码评测，即时反馈结果，帮助你快速定位问题。
                </p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50 border-0">
              <CardHeader>
                <Cpu className="h-10 w-10 text-primary mb-2" />
                <CardTitle>智能分析</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  基于大数据的代码分析，提供性能优化建议和复杂度评估。
                </p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50 border-0">
              <CardHeader>
                <GraduationCap className="h-10 w-10 text-primary mb-2" />
                <CardTitle>系统课程</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  从入门到精通的算法课程体系，循序渐进掌握编程核心思想。
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
