import { useEffect, useRef, useState } from 'react'

export function useCountUp(target: number, duration = 1800) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          return
        }
        obs.disconnect()
        let start: number | undefined
        const animate = (time: number) => {
          if (start === undefined) {
            start = time
          }
          const progress = Math.min((time - start) / duration, 1)
          const eased = 1 - (1 - progress) ** 4
          setCount(Math.round(eased * target))
          if (progress < 1) {
            requestAnimationFrame(animate)
          }
        }
        requestAnimationFrame(animate)
      },
      { threshold: 0.5 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [target, duration])

  return { count, ref }
}
