import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { HeroAvatar, HeroBar, TopBar, isPhoneTab, usePhoneApp } from '@/components/phone/PhoneKit';
import { useSalesAccess } from '@/hooks/useSalesAccess';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader(props: PageHeaderProps) {
  // The Sales app on a phone gets the phone header instead (Diamond Fencing's design).
  if (usePhoneApp()) return <PhoneHeader {...props} />;
  const { title, subtitle, action } = props;
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * A main (tab) screen gets the big coloured header with the person's circle (to More);
 * any other screen gets the coloured bar with a back arrow. The page's button sits in the
 * header, turned white so it reads on the colour.
 */
function PhoneHeader({ title, subtitle, action }: PageHeaderProps) {
  const { pathname } = useLocation();
  const { me } = useSalesAccess();
  if (isPhoneTab(pathname)) {
    return (
      <HeroBar eyebrow={subtitle} title={title} right={<HeroAvatar name={me?.name} to={pathname === '/sales/more' ? undefined : '/sales/more'} />}>
        {action ? <div className="[&_a]:bg-white [&_a]:text-primary [&_button]:border-0 [&_button]:bg-white [&_button]:text-primary [&_button]:shadow-none">{action}</div> : null}
      </HeroBar>
    );
  }
  // Opened from a notification there is no previous screen: back goes to More, where these screens live.
  const hasHistory = typeof window !== 'undefined' && ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;
  return (
    <TopBar back={hasHistory ? -1 : '/sales/more'} title={title} sub={subtitle}
      right={action ? <div className="pr-1 [&_a]:bg-white/15 [&_a]:text-white [&_button]:border-0 [&_button]:bg-white/15 [&_button]:text-white [&_button]:shadow-none">{action}</div> : undefined} />
  );
}

export default PageHeader;
