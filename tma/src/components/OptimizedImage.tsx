import { useState, type ImgHTMLAttributes } from "react";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
  /** Above-the-fold / LCP rasm — darhol yuklash. */
  priority?: boolean;
};

/** Tez rasm: lazy, async decode, yuklanганda yumshoq fade, xato bo'lsa yashirish. */
export default function OptimizedImage({
  src,
  alt = "",
  className,
  priority = false,
  style,
  ...rest
}: Props) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (failed || !src) return null;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      {...(priority ? { fetchPriority: "high" as const } : {})}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      style={
        priority
          ? style
          : {
              ...style,
              opacity: loaded ? 1 : 0,
              transition: "opacity .2s ease-out",
            }
      }
      {...rest}
    />
  );
}
