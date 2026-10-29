import { useEffect, useState } from "react";
import {
  calendarStatus,
  onCalendarUpdate,
  type CalendarStatus,
} from "../lib/tauri";

const empty: CalendarStatus = {
  connected: false,
  needsReauth: false,
  events: [],
  upcoming: null,
};

export function useCalendar() {
  const [status, setStatus] = useState<CalendarStatus>(empty);

  useEffect(() => {
    void calendarStatus().then(setStatus).catch(console.error);
    let un: (() => void) | undefined;
    void onCalendarUpdate(setStatus).then((fn) => {
      un = fn;
    });
    return () => un?.();
  }, []);

  return status;
}
