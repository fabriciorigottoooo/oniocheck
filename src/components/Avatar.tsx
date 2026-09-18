import { initials } from "@/lib/format";

export default function Avatar({
  name,
  color,
  size = 28,
  online,
  lightBorder = false,
}: {
  name: string;
  color: string;
  size?: number;
  online?: boolean;
  lightBorder?: boolean;
}) {
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.36)),
        backgroundColor: color,
      }}
    >
      {initials(name)}
      {online !== undefined && (
        <span
          className={`presence${online ? " on" : ""}`}
          style={lightBorder ? { borderColor: "#fff" } : undefined}
        />
      )}
    </span>
  );
}
