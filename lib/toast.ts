type Listener = (msg: string) => void;

const listeners = new Set<Listener>();

export function toast(msg: string) {
  listeners.forEach((listener) => listener(msg));
}

export function subscribeToast(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
