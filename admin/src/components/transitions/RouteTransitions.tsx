import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'framer-motion'
import { Outlet, useLocation } from 'react-router-dom'

const easeOut = [0.32, 0.72, 0, 1] as const

/** Zone principale admin : fondu + léger décalage vertical entre les pages. */
export function AnimatedMainOutlet() {
  const location = useLocation()
  const reduce = useReducedMotion()

  if (reduce) {
    return <Outlet />
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        role="presentation"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{
          duration: 0.3,
          ease: easeOut,
        }}
        style={{ width: '100%' }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  )
}

/** Enveloppe des routes auth : glissement horizontal léger + opacité. */
export function AuthRoutesShell() {
  const location = useLocation()
  const reduce = useReducedMotion()
  const transitionKey = `${location.pathname}${location.search}`

  if (reduce) {
    return <Outlet />
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={transitionKey}
        role="presentation"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -18 }}
        transition={{
          duration: 0.32,
          ease: easeOut,
        }}
        style={{ minHeight: '100vh' }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  )
}
