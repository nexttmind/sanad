import { Link } from "@tanstack/react-router";

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 lg:grid-cols-4 lg:px-10">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full border border-foreground/20 bg-background font-display text-lg">س</span>
            <div className="leading-tight">
              <div className="font-display text-lg">سند</div>
              <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">SANAD</div>
            </div>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            سند منصّة محلية مستقلة تُوصل المساعدات إلى العائلات النازحة في الجنوب اللبناني، بشفافية كاملة ودون وسطاء.
          </p>
        </div>
        <div>
          <div className="font-display text-sm">روابط</div>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/" className="hover:text-foreground">قدّم طلباً</Link></li>
            <li><Link to="/donate" className="hover:text-foreground">التبرّع</Link></li>
            <li><Link to="/track" className="hover:text-foreground">تتبّع طلبك</Link></li>
            <li><Link to="/admin" className="hover:text-foreground">لوحة الإدارة</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-display text-sm">للتواصل</div>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>هاتف: <span dir="ltr">+961 70 000 000</span></li>
            <li>بريد: hello@sanad.lb</li>
            <li>صور — الجنوب اللبناني</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-5 text-xs text-muted-foreground lg:flex-row lg:px-10">
          <div>© {new Date().getFullYear()} سند — جميع الحقوق محفوظة</div>
          <div className="font-mono uppercase tracking-[0.28em]">Built in Lebanon</div>
        </div>
      </div>
    </footer>
  );
}
