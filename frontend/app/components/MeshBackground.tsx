"use client";

export default function MeshBackground() {
  return (
    <div
      className="fixed inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      {/* Orb 1 – cyan/blue, top-left */}
      <div
        className="absolute rounded-full opacity-25 blur-[140px] animate-float1"
        style={{
          width: 700,
          height: 700,
          background:
            "radial-gradient(circle at center, #00d4ff 0%, #2563eb 50%, transparent 70%)",
          top: "-15%",
          left: "-12%",
        }}
      />

      {/* Orb 2 – deep violet, bottom-right */}
      <div
        className="absolute rounded-full opacity-30 blur-[160px] animate-float2"
        style={{
          width: 800,
          height: 800,
          background:
            "radial-gradient(circle at center, #7c3aed 0%, #4c1d95 50%, transparent 70%)",
          bottom: "-20%",
          right: "-15%",
        }}
      />

      {/* Orb 3 – neon blue, center-right */}
      <div
        className="absolute rounded-full opacity-20 blur-[120px] animate-float3"
        style={{
          width: 500,
          height: 500,
          background:
            "radial-gradient(circle at center, #3b82f6 0%, #1d4ed8 60%, transparent 70%)",
          top: "35%",
          right: "10%",
        }}
      />

      {/* Orb 4 – magenta accent, mid-left */}
      <div
        className="absolute rounded-full opacity-15 blur-[130px] animate-float4"
        style={{
          width: 450,
          height: 450,
          background:
            "radial-gradient(circle at center, #a855f7 0%, #6d28d9 60%, transparent 70%)",
          top: "50%",
          left: "5%",
        }}
      />

      {/* Subtle grid overlay for depth */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
    </div>
  );
}
