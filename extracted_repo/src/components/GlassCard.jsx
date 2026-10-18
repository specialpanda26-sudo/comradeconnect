export default function GlassCard({ children, className = "", as: Tag = "div", ...props }) {
  return (
    <Tag
      className={`glass rounded-card animate-floatUp ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}
