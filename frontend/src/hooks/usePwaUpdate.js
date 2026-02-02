import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { registerSW } from 'virtual:pwa-register';

export default function usePwaUpdate() {
  const registeredRef = useRef(false);

  useEffect(() => {
    if (registeredRef.current) return;
    registeredRef.current = true;

    // registerSW returns a function that triggers update (skipWaiting) when called.
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        toast.message('Update available', {
          description: 'A newer version is ready. Reload to apply it.',
          action: {
            label: 'Reload',
            onClick: () => updateSW(true),
          },
          duration: Infinity,
        });
      },
      onOfflineReady() {
        toast.success('Offline ready', {
          description:
            "Core UI is cached. Some actions (VIN decode, Tower Talk) still require internet.",
          duration: 4000,
        });
      },
    });
  }, []);
}
