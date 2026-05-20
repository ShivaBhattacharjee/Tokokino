export const RAIL_V_STYLE: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(to bottom, var(--rail) 0px, var(--rail) 6px, transparent 6px, transparent 14px), repeating-linear-gradient(to bottom, var(--rail) 0px, var(--rail) 6px, transparent 6px, transparent 14px)",
  backgroundSize: "1px 100%, 1px 100%",
  backgroundPosition: "left top, right top",
  backgroundRepeat: "no-repeat, no-repeat",
}

export const RAIL_H_STYLE: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(to right, var(--rail) 0px, var(--rail) 6px, transparent 6px, transparent 14px)",
  backgroundSize: "100% 1px",
  backgroundRepeat: "no-repeat",
}
