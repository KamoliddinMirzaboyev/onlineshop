import { useEffect } from "react";
import { onPushMessage, playOrderAlertSound } from "../push";
import { useToast } from "./Toast";

/** Turns foreground push payloads (forwarded by the SW) into in-app toasts. */
export default function PushBridge() {
  const { show } = useToast();
  useEffect(
    () =>
      onPushMessage((p) => {
        playOrderAlertSound();
        window.dispatchEvent(new CustomEvent("courier-push", { detail: p }));
        show({
          type: "push",
          title: p.title || "Barakali Bozor Kuryer",
          body: p.body || "",
          url: p.url,
          duration: 10000,
        });
      }),
    [show]
  );
  return null;
}
