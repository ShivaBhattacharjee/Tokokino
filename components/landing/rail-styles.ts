export const RAIL_V_STYLE: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(to bottom, var(--rail) 0px, var(--rail) 6px, transparent 6px, transparent 14px), linear-gradient(to bottom, var(--rail) 0px, var(--rail) 6px, transparent 6px, transparent 14px)",
  backgroundSize: "1px 14px, 1px 14px",
  backgroundPosition: "left top, right top",
  backgroundRepeat: "repeat-y, repeat-y",
}

export const RAIL_H_LEFT_STYLE: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(to left, var(--rail) 0px, var(--rail) 6px, transparent 6px, transparent 14px)",
  backgroundSize: "14px 1px",
  backgroundPosition: "calc(100% + 3px) top",
  backgroundRepeat: "repeat-x",
}

export const RAIL_H_RIGHT_STYLE: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(to right, var(--rail) 0px, var(--rail) 6px, transparent 6px, transparent 14px)",
  backgroundSize: "14px 1px",
  backgroundPosition: "-3px top",
  backgroundRepeat: "repeat-x",
}
