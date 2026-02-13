import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cpu, GraduationCap, Terminal } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      {/* Hero Section */}
      <section className="w-full flex-1 flex items-center justify-center bg-black relative overflow-hidden py-16 sm:py-20 md:py-28 lg:py-36">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        <div className="container relative z-10 flex flex-col items-center text-center">
          <div className="space-y-4 max-w-3xl mx-auto">
            <h1 className="font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary to-white">
              Master the Code
            </h1>
            <p className="mx-auto max-w-2xl text-gray-400 text-sm sm:text-base md:text-lg lg:text-xl leading-relaxed">
              Unlock your potential with our advanced coding platform. Practice, compete, and learn with a community of developers.
            </p>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Button asChild size="lg" className="h-11 px-6 text-sm sm:h-12 sm:px-8 sm:text-base">
              <Link href="/problems">开始刷题</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-11 px-6 text-sm sm:h-12 sm:px-8 sm:text-base">
              <Link href="/about">了解更多</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full py-12 sm:py-16 md:py-20 lg:py-28 bg-background">
        <div className="container">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 sm:gap-8 lg:gap-10">
            <Card className="bg-muted/50 border-0">
              <CardHeader>
                <Terminal className="h-8 w-8 sm:h-10 sm:w-10 text-primary mb-2" />
                <CardTitle>实时评测</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm sm:text-base">
                  支持多语言实时代码评测，即时反馈结果，帮助你快速定位问题。
                </p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50 border-0">
              <CardHeader>
                <Cpu className="h-8 w-8 sm:h-10 sm:w-10 text-primary mb-2" />
                <CardTitle>智能分析</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm sm:text-base">
                  基于大数据的代码分析，提供性能优化建议和复杂度评估。
                </p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50 border-0 sm:col-span-2 lg:col-span-1">
              <CardHeader>
                <GraduationCap className="h-8 w-8 sm:h-10 sm:w-10 text-primary mb-2" />
                <CardTitle>系统课程</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm sm:text-base">
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
