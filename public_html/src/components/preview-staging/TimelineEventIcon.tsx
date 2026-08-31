import { Phone, CalendarClock, Home, CreditCard, ArrowRight, Clock } from "lucide-react";

export interface TimelineEventIconProps {
  type: string;
}

export function TimelineEventIcon({ type }: TimelineEventIconProps) {
  switch (type) {
    case 'call':
      return <Phone className="h-3.5 w-3.5 text-purple-500" />;
    case 'follow_up':
      return <CalendarClock className="h-3.5 w-3.5 text-amber-500" />;
    case 'site_visit':
      return <Home className="h-3.5 w-3.5 text-teal-500" />;
    case 'payment':
      return <CreditCard className="h-3.5 w-3.5 text-green-600" />;
    case 'status_change':
      return <ArrowRight className="h-3.5 w-3.5 text-indigo-500" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-blue-500" />;
  }
}

export default TimelineEventIcon;
