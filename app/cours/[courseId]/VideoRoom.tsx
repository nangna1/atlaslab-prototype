"use client";

export default function VideoRoom({ seanceId }: { seanceId: string }) {
  const roomName = `atlaslab-${seanceId}`;
  const src = `https://meet.jit.si/${roomName}#config.prejoinPageEnabled=true`;

  return (
    <div className="mt-3 overflow-hidden rounded-lg border" style={{ borderColor: "var(--line)" }}>
      <iframe
        src={src}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        style={{ width: "100%", height: "70vh", border: "none" }}
        title="Salle de visioconférence"
      />
    </div>
  );
}
