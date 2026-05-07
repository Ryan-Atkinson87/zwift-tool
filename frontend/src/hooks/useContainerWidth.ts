import { useEffect, useRef, useState, type RefObject } from 'react'

/**
 * Measures the pixel width of a container element using a ResizeObserver.
 * Returns a ref to attach to the container and the observed width in pixels.
 * Defaults to the provided fallback until the first measurement fires.
 *
 * @param fallback  width in pixels to use before the first measurement, e.g. 700
 */
export function useContainerWidth(fallback: number = 700): {
    ref: RefObject<HTMLDivElement | null>
    width: number
} {
    const ref = useRef<HTMLDivElement | null>(null)
    const [width, setWidth] = useState<number>(fallback)

    useEffect(() => {
        if (ref.current === null) return

        // Measure immediately on mount so the first render uses the real width.
        const initialWidth = ref.current.getBoundingClientRect().width
        if (initialWidth > 0) {
            setWidth(initialWidth)
        }

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0]
            if (entry === undefined) return
            const measured = entry.contentRect.width
            if (measured > 0) {
                setWidth(measured)
            }
        })

        observer.observe(ref.current)
        return () => {
            observer.disconnect()
        }
    }, [])

    return { ref, width }
}
