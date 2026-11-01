import Link from 'next/link';

const capabilities = [
  ['01', 'تشغيل الطلبات', 'تابع الطلبات من واتساب حتى المطبخ والتوصيل دون تبديل الأدوات.'],
  ['02', 'رؤية الفروع', 'وحّد بيانات الشركات والفروع مع صلاحيات واضحة لكل فريق.'],
  ['03', 'قرارات أسرع', 'حوّل المحادثات والعمليات اليومية إلى مؤشرات قابلة للقياس.'],
];

const metrics = [
  ['1,248', 'طلباً اليوم', '↑ 18.4%'],
  ['96.8%', 'نسبة الالتزام', '↑ 4.2%'],
  ['14', 'فرعاً متصلاً', 'نشط الآن'],
];

export default function HomePage() {
  return (
    <main className="overflow-hidden">
      <section className="relative isolate bg-[#071827] text-white">
        <div className="absolute inset-0 -z-10 opacity-60 surface-grid" />
        <div className="absolute -left-40 top-0 -z-10 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
          <Link href="/" className="flex items-center gap-3 font-black tracking-[0.22em]">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-400 text-lg text-[#071827] shadow-lg shadow-cyan-400/20">
              C
            </span>
            CHATPILOT
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/login"
              className="hidden rounded-xl px-4 py-2 text-slate-200 transition hover:bg-white/10 sm:inline-flex"
            >
              تسجيل الدخول
            </Link>
            <Link
              href="/login"
              className="rounded-xl bg-cyan-400 px-4 py-2.5 font-bold text-[#071827] transition hover:bg-cyan-300"
            >
              ابدأ الآن
            </Link>
          </div>
        </nav>

        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:pb-28 lg:pt-20">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-bold text-cyan-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
              منصة تشغيل التجارة التحادثية
            </span>
            <h1 className="text-balance mt-6 text-4xl font-black leading-[1.15] sm:text-6xl">
              حوّل كل محادثة إلى عملية تجارية ناجحة.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-slate-300 sm:text-lg">
              ChatPilot يجمع الطلبات، الفروع، المطبخ، التوصيل، واتساب والتحليلات في مساحة عمل واحدة
              واضحة لفريقك.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-2xl bg-cyan-400 px-6 py-3.5 text-sm font-black text-[#071827] shadow-xl shadow-cyan-950/30 transition hover:-translate-y-0.5 hover:bg-cyan-300"
              >
                دخول إلى مساحة العمل <span aria-hidden>←</span>
              </Link>
              <a
                href="#capabilities"
                className="rounded-2xl border border-white/15 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10"
              >
                اكتشف المنصة
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400">
              <span>✓ صلاحيات متعددة المستويات</span>
              <span>✓ تحديثات لحظية</span>
              <span>✓ عربي وإنجليزي</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute -inset-4 rounded-[2rem] bg-cyan-400/10 blur-2xl" />
            <div className="relative rounded-[2rem] border border-white/10 bg-white/10 p-2 shadow-2xl backdrop-blur">
              <div className="overflow-hidden rounded-[1.5rem] bg-slate-50 text-slate-900">
                <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      مساحة العمل
                    </p>
                    <p className="mt-1 font-black">نظرة عامة اليوم</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700">
                    كل الأنظمة تعمل
                  </span>
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-3">
                  {metrics.map(([value, label, trend]) => (
                    <div key={label} className="rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="text-xl font-black text-slate-900">{value}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{label}</p>
                      <p className="mt-2 text-[10px] font-bold text-emerald-600">{trend}</p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 p-4 pt-1 sm:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black">تدفق الطلبات</p>
                      <span className="text-[10px] text-slate-400">آخر 7 أيام</span>
                    </div>
                    <div className="mt-6 flex h-28 items-end gap-2">
                      {[38, 54, 46, 72, 64, 88, 78, 96, 83, 100].map((height, index) => (
                        <span
                          key={index}
                          className={`flex-1 rounded-t-md ${index === 9 ? 'bg-cyan-500' : 'bg-cyan-100'}`}
                          style={{ height: `${height}%` }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-black">حالة التشغيل</p>
                    <div className="mt-5 space-y-3 text-[11px]">
                      <p className="flex justify-between">
                        <span className="text-slate-500">المطبخ</span>
                        <b className="text-emerald-600">مستقر</b>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-slate-500">التوصيل</span>
                        <b className="text-amber-600">3 بانتظار</b>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-slate-500">واتساب</span>
                        <b className="text-emerald-600">متصل</b>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="capabilities" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
        <div className="max-w-2xl">
          <p className="text-sm font-black text-brand-600">مصمم للعمليات الحقيقية</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            وضوح أكبر لفريقك، من أول طلب إلى آخر تقرير.
          </h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {capabilities.map(([number, title, description]) => (
            <article
              key={number}
              className="rounded-3xl border border-slate-200 bg-white p-7 shadow-soft transition hover:-translate-y-1"
            >
              <span className="text-sm font-black text-cyan-600">{number}</span>
              <h3 className="mt-10 text-xl font-black text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-500">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="font-black tracking-widest text-slate-900">CHATPILOT</span>
          <span>إدارة أذكى. تشغيل أسرع. نمو مستمر.</span>
          <Link href="/login" className="font-bold text-brand-600 hover:text-brand-700">
            تسجيل الدخول ←
          </Link>
        </div>
      </footer>
    </main>
  );
}
