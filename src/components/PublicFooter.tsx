import { Link } from "@tanstack/react-router";
import { usePublicSiteConfig } from "@/lib/use-public-site-config";
import { sanadLogoPhoto } from "@/lib/donate-photos";

export function PublicFooter() {
  const { config } = usePublicSiteConfig();

  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 sm:py-14 lg:grid-cols-4 lg:px-10">
        <div className="sm:col-span-2 lg:col-span-2">
          <div className="flex items-center gap-3">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-foreground/20 bg-background p-0.5">
              <img src={sanadLogoPhoto} alt="" className="h-full w-full scale-[1.15] rounded-full object-contain" />
            </span>
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
            <li>هاتف: <span dir="ltr" className="break-all">{config.contact.footer_phone}</span></li>
            <li>بريد: <span className="break-all">{config.contact.footer_email}</span></li>
            <li>{config.contact.footer_location}</li>
            <li>
              <a
                href={config.contact.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-foreground"
              >
                Instagram
                <span dir="ltr" className="font-mono text-[12px]">@hsaleh94</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-5 py-5 text-xs text-muted-foreground sm:px-6 lg:flex-row lg:px-10">
          <div>© {new Date().getFullYear()} سند — جميع الحقوق محفوظة</div>
          <div className="font-mono uppercase tracking-[0.28em]">Built in Lebanon</div>
        </div>
      </div>
    </footer>
  );
}
