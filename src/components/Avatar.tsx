import { initials } from "@/lib/format";

export default function Avatar({
  name,
  color,
  size = 28,
  online,
  lightBorder = false,
  imageUrl,
}: {
  name: string;
  color: string;
  size?: number;
  online?: boolean;
  lightBorder?: boolean;
  imageUrl?: string | null;
}) {
  if (imageUrl) {
    return (
      <span
        className="avatar avatar-photo"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          backgroundColor: color,
        }}
      >
        <img src={imageUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        {online !== undefined && (
          <span
            className={`presence${online ? " on" : ""}`}
            style={lightBorder ? { borderColor: "#fff" } : undefined}
          />
        )}
      </span>
    );
  }

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
