import * as React from "react"

export function useProtected() {
  // simple check, ideally combine with useAuth
  React.useEffect(() => {
    // client side check, redirect if no cookie or state
    // but useAuth handles this better
  }, [])
}
