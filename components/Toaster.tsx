"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { subscribeToast } from "@/lib/toast";

interface Item {
  id: number;
  msg: string;
}

export function Toaster() {
  const [items, setItems] = useState<Item[]>([]);
  const counter = useRef(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const unsubscribe = subscribeToast((msg) => {
      const id = ++counter.current;
      setItems((prev) => [...prev.slice(-2), { id, msg }]);
      timers.push(
        setTimeout(() => {
          setItems((prev) => prev.filter((i) => i.id !== id));
        }, 2600),
      );
    });
    return () => {
      unsubscribe();
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="toast-wrap">
      {items.map((i) => (
        <div key={i.id} className="toast">
          <Check size={13} style={{ color: "var(--green)" }} />
          {i.msg}
        </div>
      ))}
    </div>
  );
}
