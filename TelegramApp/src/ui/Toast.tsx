interface ToastProps {
  text: string | null
}

/** Ported from GamePhone.dc.html's toast pill - the app's lowest-ceremony feedback tier. */
export function Toast({ text }: ToastProps) {
  if (!text) return null
  return (
    <div className="toast">
      <span>{text}</span>
    </div>
  )
}
